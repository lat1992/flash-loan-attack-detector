import app from "./app";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.info(`Server is running on port ${port}`);
});
