const express = require('express');
const app = express();
// const port = 3002;
import cors from "cors";

app.get('/', (req, res) => {
    res.send('Hello from Express!');
});


// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });


app.use(cors({
    origin: function (origin, callback) {
        console.log("REQUEST ORIGIN:", origin);
        console.log("ENV CLIENT_URL:", process.env.CLIENT_URL);

        const allowed = [
            "http://localhost:3000",
            "https://booksalon.vercel.app"
        ];

        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Blocked by CORS"));
        }
    },
    credentials: true
}));