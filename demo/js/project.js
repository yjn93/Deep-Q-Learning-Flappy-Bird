var canvas, ctx;
    
    // A 2D vector utility
    var Vec = function(x, y) {
      this.x = x;
      this.y = y;
    }
    Vec.prototype = {
      
      // utilities
      dist_from: function(v) { return Math.sqrt(Math.pow(this.x-v.x,2) + Math.pow(this.y-v.y,2)); },
      length: function() { return Math.sqrt(Math.pow(this.x,2) + Math.pow(this.y,2)); },
      
      // new vector returning operations
      add: function(v) { return new Vec(this.x + v.x, this.y + v.y); },
      sub: function(v) { return new Vec(this.x - v.x, this.y - v.y); },
      rotate: function(a) {  // CLOCKWISE
        return new Vec(this.x * Math.cos(a) + this.y * Math.sin(a),
                       -this.x * Math.sin(a) + this.y * Math.cos(a));
      },
      
      // in place operations
      scale: function(s) { this.x *= s; this.y *= s; },
      normalize: function() { var d = this.length(); this.scale(1.0/d); }
    }
    
    // line intersection helper function: does line segment (p1,p2) intersect segment (p3,p4) ?
    var line_intersect = function(p1,p2,p3,p4) {
      var denom = (p4.y-p3.y)*(p2.x-p1.x)-(p4.x-p3.x)*(p2.y-p1.y);
      if(denom===0.0) { return false; } // parallel lines
      var ua = ((p4.x-p3.x)*(p1.y-p3.y)-(p4.y-p3.y)*(p1.x-p3.x))/denom;
      var ub = ((p2.x-p1.x)*(p1.y-p3.y)-(p2.y-p1.y)*(p1.x-p3.x))/denom;
      if(ua>0.0&&ua<1.0&&ub>0.0&&ub<1.0) {
        var up = new Vec(p1.x+ua*(p2.x-p1.x), p1.y+ua*(p2.y-p1.y));
        return {ua:ua, ub:ub, up:up}; // up is intersection point
      }
      return false;
    }
    
    var line_point_intersect = function(p1,p2,p0,rad) {
      var v = new Vec(p2.y-p1.y,-(p2.x-p1.x)); // perpendicular vector
      var d = Math.abs((p2.x-p1.x)*(p1.y-p0.y)-(p1.x-p0.x)*(p2.y-p1.y));
      d = d / v.length();
      if(d > rad) { return false; }
      v.normalize();
      v.scale(d);
      var up = p0.add(v);
      if(Math.abs(p2.x-p1.x)>Math.abs(p2.y-p1.y)) {
        var ua = (up.x - p1.x) / (p2.x - p1.x);
      } else {
        var ua = (up.y - p1.y) / (p2.y - p1.y);
      }
      if(ua>0.0&&ua<1.0) {
        return true;
      }
      return false;
    }

    // Wall is made up of two points
    var Wall = function(p1, p2) {
      this.p1 = p1;
      this.p2 = p2;
    }
    
    // World object contains many agents and walls and food and stuff
    var util_add_box = function(lst, x, y, w, h) {
      lst.push(new Wall(new Vec(x,y), new Vec(x+w,y)));
      lst.push(new Wall(new Vec(x+w,y), new Vec(x+w,y+h)));
      lst.push(new Wall(new Vec(x+w,y+h), new Vec(x,y+h)));
      lst.push(new Wall(new Vec(x,y+h), new Vec(x,y)));
    }
    
    // Pipe is made up with two pipes and a gap between.
    var Pipe = function(x, height) {
      this.gap = new Vec(x, height); // position of the gap
      this.size = 100 //default size of pipe
      this.v = -1; // default moving velocity
    }
    
    var World = function() {
      this.agent = new Agent();
      this.W = canvas.width;
      this.H = canvas.height;
      
      this.clock = 0;
      this.walls = []; 
      this.pad = 5;
      this.walls.push(new Wall(new Vec(0, this.pad), new Vec(this.W, this.pad)));
      this.walls.push(new Wall(new Vec(0, this.H-this.pad), new Vec(this.W, this.H-this.pad)));

      // set up pipes pool
      this.pipes = [];
      for(var k=1;k<6;k++) {
        var x = k*300 - 100
        var y = 50*convnetjs.randi(2, 9); // the gap's height can be integer 2 to 8
        var it = new Pipe(x, y);
        this.pipes.push(it);
      }
    }
    
    World.prototype = {      
      // helper function to get closest colliding walls/items
      stuff_collide_: function(closest_pipe) {
        var collide = false;
        var bird = this.agent;
        //collide with walls
        
        if(bird.position.y<this.pad || bird.position.y>this.H-this.pad){
          //console.log("collision with walls");
          return 1;
        }
          
        for(var i=0;i<this.walls.length;i++) {
          var wall = this.walls[i];
          collide = line_point_intersect(wall.p1, wall.p2, bird.position, bird.rad);
        }
        if(collide) {
          //console.log("collision with walls");
          return 1; //if collide with wall, return collision type 1
        }
        var frames = [];
        var pipe_x = closest_pipe.gap.x;
        var gap_h = closest_pipe.gap.y;
        var gap_size = 75;
        util_add_box(frames, pipe_x, 0, closest_pipe.size, gap_h-gap_size);
        util_add_box(frames, pipe_x, gap_h+gap_size, closest_pipe.size, this.H-gap_h+gap_size);        
        for(var i=0;i<frames.length;i++) {
          var frame = frames[i];
          collide = line_point_intersect(frame.p1, frame.p2, bird.position, bird.rad);   
          if(collide) {
            //console.log("collision with pipes");
            return Math.abs(gap_h - bird.position.y)/this.H; //if collide with pipe, return destance to gap
          }        
        }    
        return false;
        
      },
      update_world: function() {
        this.agent.velocity += this.agent.gravity;
        this.agent.position.y += this.agent.velocity;
        // update all pipes
        for(var i=0;i<this.pipes.length;i++) {
          var pipe = this.pipes[i];
          pipe.gap.x += pipe.v;
        }
        if(this.pipes[0].gap.x<-100){
          this.pipes.shift();
          var x = this.pipes.length*300+200;
          var y = 50*convnetjs.randi(2, 9); // the gap's height can be integer 2 to 8
          var it = new Pipe(x, y);
          this.pipes.push(it);
        }

      },
      tick: function() {
        // tick the environment
        this.clock++;
        if(this.clock) {
          var current_pipe;
          for(var i=0;i<this.pipes.length;i++) {
            var pipe = this.pipes[i];
            if(pipe.gap.x>0&&pipe.gap.x<=300){
              current_pipe = pipe;
            }
          }
          this.agent.current_gap = current_pipe.gap;
          // let the agent behave in the world based on its input
          this.agent.forward();
          
          
          // apply outputs of agent on evironment
          if(this.agent.action) {
            //action type 1, flap
            this.agent.velocity = -5; //update velocity of the bird to -5
            this.agent.position.y += this.agent.velocity;
          }
          else {
            //do not flap
            this.agent.velocity += this.agent.gravity;
            this.agent.position.y += this.agent.velocity;
          }
          
          // tick all pipes
          for(var i=0;i<this.pipes.length;i++) {
            var pipe = this.pipes[i];
            pipe.gap.x += pipe.v;
          }
          if(this.pipes[0].gap.x<=-100){
            this.pipes.shift();
            var x = this.pipes.length*300+200;
            var y = 50*convnetjs.randi(2, 9); // the gap's height can be integer 2 to 8
            var it = new Pipe(x, y);
            this.pipes.push(it);
          }

          var bird_x = this.agent.position.x;
          var bird_y = this.agent.position.y;


          var collision = this.stuff_collide_(current_pipe);

          if(collision) {
            // bird collide with wall or pipe
            this.agent.collision_sense = collision;
            this.agent.reload();
            // reset pipes pool
            this.pipes = [];
            for(var k=1;k<7;k++) {
              var x = k*300-100
              var y = convnetjs.randi(2, 9); // the gap's height can be integer 1 to 7
              var it = new Pipe(x, y*50);
              this.pipes.push(it);
            }
          }
          else {
            this.agent.collision_sense = 0;
            this.agent.score ++;
           }
          // agents are given the opportunity to learn based on feedback of their action on environment
          this.agent.backward();
        } 
        else {
          this.update_world();
        }
      }

    }

    // A single agent
    var Agent = function() {
    
      // positional information
      this.position = new Vec(100, 250);
      
      // properties
      this.rad = 12; //default radius
      this.velocity = 0;
      this.gravity = 0.5; //default gravity
      this.current_gap = new Vec(200,250);
      //reward signal
      this.collision_sense = 0;
      this.score = 100;

      // brain
      //this.brain = new deepqlearn.Brain(this.eyes.length * 3, this.actions.length);
      var spec = document.getElementById('qspec').value;
      eval(spec);
      this.brain = brain;

      
      // outputs on world
      this.action = 1; //action can be 0 or 1, 0: do not flap; 1: flap
      
    }
    Agent.prototype = {
      forward: function() {
        // in forward pass the agent simply behaves in the environment
        // create input to brain
        var input_array = new Array(3);
        input_array[0] = this.velocity; //normalize velocity
        input_array[1] = this.current_gap.x/200;
        input_array[2] = (this.current_gap.y-100)/800;
        
        // get action from brain
        this.action = this.brain.forward(input_array);
        //console.log("action:",this.action, this.velocity);
      },
      backward: function() {
        // in backward pass agent learns.
        // compute reward 
        var reward = 0.0;
        if(this.collision_sense){

          reward = -2000*this.collision_sense;
          //console.log("reward",reward);
          //alert("collision reward"+reward);
        }
        else{
          reward = 1;
          //console.log("reward",reward);
        }
            
        // pass to brain for learning
        this.brain.backward(reward);
      },

      reload: function() {
        this.position = new Vec(100, 250);       
        this.actions = 0; //action can be 0 or 1, 0: do not flap; 1: flap
        // properties
        this.rad = 10; //default radius
        this.velocity = 0;
        this.gravity = 0.5; //default gravity
        this.current_gap = new Vec(200,250);
        this.score = 100;
      }
    }
    
    
    // Draw everything
    function draw() {  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      var agent = w.agent;
      
      // draw walls in environment
      ctx.strokeStyle = "rgb(0,0,0)";
      ctx.beginPath();
      for(var i=0,n=w.walls.length;i<n;i++) {
        var q = w.walls[i];
        ctx.moveTo(q.p1.x, q.p1.y);
        ctx.lineTo(q.p2.x, q.p2.y);
      }
      ctx.stroke();
  
      // // draw agents
      // ctx.fillStyle = "rgb(255,0,0)";
      // ctx.strokeStyle = "rgb(0,0,0)";
      // ctx.beginPath();
      // ctx.arc(agent.position.x, agent.position.y, agent.rad, 0, Math.PI*2, true); 
      // ctx.fill();
      // ctx.stroke();
      ctx.font = "30px Arial";
      ctx.fillText((Math.floor(agent.score/300)).toString(),10,50);

      var bird_img = document.getElementById("bird");
      ctx.drawImage(bird_img, agent.position.x-15, agent.position.y-10, 27, 20);
      // draw pipes
      ctx.strokeStyle = "rgb(0,0,0)";
      ctx.fillStyle = "rgb(0, 255, 0)";
      for(var i=0,n=w.pipes.length;i<n;i++) {
        var pipe = w.pipes[i];    
        ctx.beginPath();
        ctx.rect(pipe.gap.x,0,pipe.size,pipe.gap.y-75);
        ctx.rect(pipe.gap.x,pipe.gap.y+75,pipe.size,w.H-pipe.gap.y-75);
        ctx.fill();
        ctx.stroke();
      }
      
      w.agent.brain.visSelf(document.getElementById('brain_info_div'));
    }
    
    // Tick the world
    function tick() {
      w.tick();
      draw();
      
    }
    
    var simspeed = 2;

    function gonormal() {
      window.clearInterval(current_interval_id);
      current_interval_id = setInterval(tick, 20);
      skipdraw = false;
      simspeed = 1;
    }

    function savenet() {
      var j = w.agent.brain.value_net.toJSON();
      var t = JSON.stringify(j);
      document.getElementById('tt').value = t;
    }
    
    function loadnet() {
      var t = document.getElementById('tt').value;
      var j = JSON.parse(t);
      w.agent.brain.value_net.fromJSON(j);
      stoplearn(); // also stop learning
      gonormal();
    }
    
    var w; // global world object
    var current_interval_id;
    var skipdraw = false;
    function start() {
      canvas = document.getElementById("canvas");
      ctx = canvas.getContext("2d");    
      w = new World();    
      gonormal();
    }