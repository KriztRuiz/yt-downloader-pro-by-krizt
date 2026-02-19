const { spawn } = require('child_process');

// Extrae porcentaje de progreso, velocidad y ETA de la línea de salida
function parseProgressLine(line) {
  const m = line.match(
    /\[download\]\s+(\d+(?:\.\d+)?)%.*?(?:at\s+([^\s]+)\/s)?(?:\s+ETA\s+([0-9:]+))?/i
  );
  if (!m) return null;
  return {
    percent: Number(m[1]),
    speed: m[2] || '',
    eta: m[3] || '',
  };
}

// Ejecuta un proceso y envía progreso a un callback
function runProcess(exe, args, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    const handleLine = (data) => {
      data
        .toString()
        .split(/\r?\n/)
        .forEach((line) => {
          if (!line.trim()) return;
          const progress = parseProgressLine(line);
          if (progress && onProgress) onProgress(progress);
        });
    };
    child.stdout.on('data', handleLine);
    child.stderr.on('data', handleLine);
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${exe} se cerró con código ${code}`));
    });
  });
}

module.exports = {
  parseProgressLine,
  runProcess,
};
