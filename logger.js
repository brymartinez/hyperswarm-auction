class Logger {
  log(message, ...data) {
    console.log(message, ...data);
  }

  debug(message, ...data) {
    if (process.env.DEBUG) {
      console.debug(message, ...data);
    }
  }

  error(message, ...data) {
    console.error(message, ...data);
  }
}

module.exports = new Logger();
