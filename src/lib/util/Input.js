export async function readStdIn() {
  return read(process.openStdin());
}

async function read(buffer) {
  return new Promise((resolve, reject) => {
    let inputString = "";

    buffer.on("data", data => {
      inputString += data;
    });

    buffer.on("error", error => {
      reject(error);
    });

    buffer.on("end", () => {
      resolve(inputString);
    });
  });
}
