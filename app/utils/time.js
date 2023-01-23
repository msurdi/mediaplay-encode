const sleepSeconds = async (time) =>
  new Promise((resolve) => {
    setTimeout(resolve, time * 1000);
  });

module.exports = { sleepSeconds };
