// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dibujar fondo y marco
function drawBackground(frame) {
  ctx.fillStyle = "#2e2e2e"; // gris oscuro
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h); // marco blanco
}

// Función para generar velocidad aleatoria dentro de un rango
function getRandomSpeed(min, max) {
  return Math.random() * (max - min) + min;
}

// Clase Ball (Pelota)
class Ball {
  constructor(x, y, radius, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    // Velocidades aleatorias y diferentes para cada pelota
    this.speedX = getRandomSpeed(3, 8) * (Math.random() > 0.5 ? 1 : -1);
    this.speedY = getRandomSpeed(3, 8) * (Math.random() > 0.5 ? 1 : -1);
    this.color = color;
    // Velocidad angular para efecto visual (opcional)
    this.rotation = 0;
    this.rotationSpeed = getRandomSpeed(0.02, 0.08);
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();

    // Opcional: dibujar un patrón o línea para visualizar la rotación
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + Math.cos(this.rotation) * this.radius,
      this.y + Math.sin(this.rotation) * this.radius
    );
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
  }

  move(frame) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;

    // Colisión con parte superior e inferior del marco
    if (this.y - this.radius <= frame.y || this.y + this.radius >= frame.y + frame.h) {
      this.speedY = -this.speedY;
    }
  }

  reset(frame) {
    this.x = frame.x + frame.w / 2;
    this.y = frame.y + frame.h / 2;
    // Nueva velocidad aleatoria al resetear
    this.speedX = getRandomSpeed(3, 8) * (Math.random() > 0.5 ? 1 : -1);
    this.speedY = getRandomSpeed(3, 8) * (Math.random() > 0.5 ? 1 : -1);
  }
}

// Clase Paddle (Paleta)
class Paddle {
  constructor(x, y, w, h, color, isPlayer, speed = 6) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.color = color;
    this.isPlayer = !!isPlayer;
    this.speed = speed;
    this.direction = 1; // dirección inicial (1 = abajo, -1 = arriba)
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }

  move(direction, frame) {
    if (direction === 'up' && this.y > frame.y) {
      this.y -= this.speed;
    } else if (direction === 'down' && this.y + this.h < frame.y + frame.h) {
      this.y += this.speed;
    }
  }

  // Movimiento automático inteligente para salvar pelotas
  smartDefense(balls, frame) {
    // Filtrar pelotas que se acercan a esta paleta
    const approachingBalls = balls.filter(ball => {
      if (this.isPlayer) {
        // Para paleta izquierda, pelotas que se mueven hacia la izquierda
        return ball.speedX < 0;
      } else {
        // Para paleta derecha, pelotas que se mueven hacia la derecha
        return ball.speedX > 0;
      }
    });

    if (approachingBalls.length === 0) {
      // Si no hay pelotas acercándose, patrulla normal
      this.patrol(frame);
      return;
    }

    // Encontrar la pelota más cercana o más peligrosa
    let targetBall = approachingBalls[0];
    let minTimeToReach = Infinity;

    approachingBalls.forEach(ball => {
      // Calcular tiempo estimado para que la pelota llegue a la paleta
      const distanceX = this.isPlayer ? 
        (ball.x - ball.radius - (this.x + this.w)) : 
        (this.x - (ball.x + ball.radius));
      
      const timeToReach = Math.abs(distanceX / ball.speedX);
      
      if (timeToReach < minTimeToReach) {
        minTimeToReach = timeToReach;
        targetBall = ball;
      }
    });

    // Predecir posición Y de la pelota cuando llegue a la paleta
    const predictedY = targetBall.y + (targetBall.speedY * minTimeToReach);
    
    // Ajustar para rebotes en paredes superior e inferior
    let finalPredictedY = predictedY;
    const frameTop = frame.y;
    const frameBottom = frame.y + frame.h;
    const ballRadius = targetBall.radius;
    
    // Simular rebotes hasta que la pelota llegue a la paleta
    let simulationY = targetBall.y;
    let simulationTime = minTimeToReach;
    let simulationSpeedY = targetBall.speedY;
    
    while (simulationTime > 0) {
      const timeToNextWall = simulationSpeedY > 0 ? 
        (frameBottom - ballRadius - simulationY) / simulationSpeedY :
        (frameTop + ballRadius - simulationY) / simulationSpeedY;
      
      if (timeToNextWall >= simulationTime) {
        // No hay más rebotes antes de llegar
        simulationY += simulationSpeedY * simulationTime;
        break;
      } else {
        // Hay un rebote
        simulationY += simulationSpeedY * timeToNextWall;
        simulationSpeedY = -simulationSpeedY; // Rebota
        simulationTime -= timeToNextWall;
      }
    }
    
    finalPredictedY = simulationY;

    // Calcular posición objetivo de la paleta (centro de la paleta alineado con la pelota)
    const paddleCenter = this.y + this.h / 2;
    const targetPosition = finalPredictedY - this.h / 2;

    // Mover la paleta hacia la posición objetivo con mayor velocidad
    const speedMultiplier = 2.5; // Aumentar velocidad de la paleta roja
    const effectiveSpeed = this.speed * speedMultiplier;

    if (Math.abs(paddleCenter - finalPredictedY) > 5) { // Pequeño margen para evitar vibración
      if (paddleCenter > finalPredictedY) {
        // Mover hacia arriba
        this.y = Math.max(frame.y, this.y - effectiveSpeed);
      } else {
        // Mover hacia abajo
        this.y = Math.min(frame.y + frame.h - this.h, this.y + effectiveSpeed);
      }
    }
  }

  // Movimiento automático continuo (sube y baja dentro del marco)
  patrol(frame) {
    this.y += this.speed * this.direction;

    if (this.y <= frame.y) {
      this.y = frame.y;
      this.direction = 1; // cambia a bajar
    }
    if (this.y + this.h >= frame.y + frame.h) {
      this.y = frame.y + frame.h - this.h;
      this.direction = -1; // cambia a subir
    }
  }
}

// Clase Game
class Game {
  constructor() {
    // Marco interior
    this.frame = { x: 50, y: 50, w: canvas.width - 100, h: canvas.height - 100 };

    // Varias pelotas con velocidades diferentes y aleatorias
    this.balls = [
      new Ball(canvas.width / 2, canvas.height / 2, 15, "cyan"),
      new Ball(canvas.width / 2, canvas.height / 3, 12, "magenta"),
      new Ball(canvas.width / 2, canvas.height / 1.5, 8, "yellow"),
      new Ball(canvas.width / 2, canvas.height / 1.2, 6, "lime"),
      new Ball(canvas.width / 2, canvas.height / 1.1, 10, "orange"),
      new Ball(canvas.width / 2, canvas.height / 4, 5, "pink"),
      new Ball(canvas.width / 2, canvas.height / 1.3, 7, "lightblue"),
      new Ball(canvas.width / 2, canvas.height / 1.8, 9, "gold")
    ];

    // Paletas - Aumentar velocidad de la paleta roja
    this.paddle1 = new Paddle(this.frame.x + 5, this.frame.y + this.frame.h / 2 - 100, 12, 200, 'green', true, 6);
    this.paddle2 = new Paddle(this.frame.x + this.frame.w - 17, this.frame.y + this.frame.h / 2 - 50, 12, 100, 'red', false, 10); // Mayor velocidad base

    this.keys = {};
    this.score = { player: 0, enemy: 0 };
  }

  draw() {
    drawBackground(this.frame);

    this.balls.forEach(ball => ball.draw());
    this.paddle1.draw();
    this.paddle2.draw();

    // Mostrar puntuación
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(`Jugador: ${this.score.player}`, 20, 30);
    ctx.fillText(`Rival: ${this.score.enemy}`, canvas.width - 100, 30);
  }

  update() {
    this.balls.forEach(ball => {
      ball.move(this.frame);

      // Colisión con paleta izquierda
      if (ball.x - ball.radius <= this.paddle1.x + this.paddle1.w &&
        ball.y >= this.paddle1.y && ball.y <= this.paddle1.y + this.paddle1.h) {
        ball.speedX = Math.abs(ball.speedX); // Asegurar que vaya hacia la derecha
        // Pequeño ajuste de posición para evitar que se quede pegada
        ball.x = this.paddle1.x + this.paddle1.w + ball.radius;
        // Variación en el rebote basado en dónde golpea la paleta
        const hitPosition = (ball.y - this.paddle1.y) / this.paddle1.h;
        ball.speedY += (hitPosition - 0.5) * 2; // Efecto de ángulo
      }

      // Colisión con paleta derecha
      if (ball.x + ball.radius >= this.paddle2.x &&
        ball.y >= this.paddle2.y && ball.y <= this.paddle2.y + this.paddle2.h) {
        ball.speedX = -Math.abs(ball.speedX); // Asegurar que vaya hacia la izquierda
        // Pequeño ajuste de posición para evitar que se quede pegada
        ball.x = this.paddle2.x - ball.radius;
        // Variación en el rebote basado en dónde golpea la paleta
        const hitPosition = (ball.y - this.paddle2.y) / this.paddle2.h;
        ball.speedY += (hitPosition - 0.5) * 2; // Efecto de ángulo
      }

      // Reinicio si sale por los lados del marco y actualizar puntuación
      if (ball.x - ball.radius <= this.frame.x) {
        this.score.enemy++;
        ball.reset(this.frame);
      } else if (ball.x + ball.radius >= this.frame.x + this.frame.w) {
        this.score.player++;
        ball.reset(this.frame);
      }
    });

    // Movimiento jugador
    if (this.keys['ArrowUp']) {
      this.paddle1.move('up', this.frame);
    }
    if (this.keys['ArrowDown']) {
      this.paddle1.move('down', this.frame);
    }

    // Movimiento automático inteligente para la paleta roja
    this.paddle2.smartDefense(this.balls, this.frame);
  }

  handleInput() {
    window.addEventListener('keydown', (event) => {
      this.keys[event.key] = true;
    });

    window.addEventListener('keyup', (event) => {
      this.keys[event.key] = false;
    });
  }

  run() {
    this.handleInput();
    const gameLoop = () => {
      this.update();
      this.draw();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }
}

// Iniciar juego
const game = new Game();
game.run();