const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const port = 3000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const jwt = require("jsonwebtoken");

mongoose.connect("mongodb+srv://waqarmehmoodrana54:a1b2c3d456@cluster0.bebkdxq.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected To MongoDB ")
}).catch((err) => {
    console.log("error Connecting to MongoDB")
})



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})



const User = require('./models/user');
const Post = require('./models/post');


// endpoint to register a new user  in the Backend 
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "email already exists" });
        }


        // craete a new User

        const newUser = new User({ name, email, password });


        // Generate and store the verification token 
        newUser.verificationToken = crypto.randomBytes(20).toString("hex");

        // Save  the new user to database 

        await newUser.save();

        // Send the verificatin email to the user 
        sendVerificationEmail(newUser.email, newUser.verificationToken);

        res.status(200).json({ message: " Registration successful!" + "Please check your email for verification" });

    } catch (error) {
        console.log("error registering user", error);
        res.status(500).json({ message: "error registering user" })

    }
})



// function to send verification email
const sendVerificationEmail = async (email, verificationToken) => {
    // create a nodemailer tranporter 

    const transpoter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "waqarmehmoodrana54@gmail.com",
            pass: "ruwp qlal nwlk glan"
        }
    });


    // Compose the email message

    const mailOptions = {
        from: "threads.com",
        to: email,
        subject: "Email Verification",
        text: `Please click the following link  to verify your email http://localhost:3000/verify/${verificationToken}`
    }


    try {
        await transpoter.sendMail(mailOptions);
    } catch (error) {
        console.log("error Sending email", error);

    }
}


app.get("/verify/:token", async (req, res) => {
    try {
        const token = req.params.token;

        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(404).json({ message: "Invalid token" });
        }

        user.verified = true;
        user.verificationToken = undefined;
        await user.save();

        res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
        console.log("error getting token", error);
        res.status(500).json({ message: "Email verification failed" });
    }
});


// Function to genrate the secret Key 
const generateSecretKey = () => {
    const secretKey = crypto.randomBytes(32).toString("hex");
    return secretKey;
};

const secretKey = generateSecretKey();


// Endpoint to login the User
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Invalid email" });
        }

        if (user.password !== password) {
            return res.status(404).json({ message: "Invalid password" });
        }

        const token = jwt.sign({ userId: user._id }, secretKey);

        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: "Login failed" });
    }
});

// Endpoint to access all the users except the logged in the user
app.get("/user/:userId", (req, res) => {
    try {
        const loggedInUserId = req.params.userId;

        User.find({ _id: { $ne: loggedInUserId } })
            .then((users) => {
                res.status(200).json(users);
            })
            .catch((error) => {
                console.log("Error: ", error);
                res.status(500).json("error");
            });
    } catch (error) {
        res.status(500).json({ message: "error getting the users" });
    }
});


//endpoint to follow a particular user
app.post("/follow", async (req, res) => {
    const { currentUserId, selectedUserId } = req.body;

    try {
        await User.findByIdAndUpdate(selectedUserId, {
            $push: { followers: currentUserId },
        });

        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "error in following a user" });
    }
});

//endpoint to unfollow a user
app.post("/users/unfollow", async (req, res) => {
    const { loggedInUserId, targetUserId } = req.body;

    try {
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { followers: loggedInUserId },
        });

        res.status(200).json({ message: "Unfollowed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error unfollowing user" });
    }
});


// Endpoint to create a new post in Backend
app.post("/create-post", async (req, res) => {
    try {
        const { content, userId } = req.body;
        const newPostData = {
            user: userId,
        }

        if (content) {
            newPostData.content = content;
        }

        const newPost = new Post(newPostData);

        await newPost.save();


        res.status(200).json({ message: "Post Saved Successfully" });

    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "Error in creating the post" })
    }
})



//endpoint for liking a particular post
app.put("/posts/:postId/:userId/like", async (req, res) => {
    const postId = req.params.postId;
    const userId = req.params.userId; // Assuming you have a way to get the logged-in user's ID

    try {
        const post = await Post.findById(postId).populate("user", "name");

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $addToSet: { likes: userId } }, // Add user's ID to the likes array
            { new: true } // To return the updated post
        );

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }
        updatedPost.user = post.user;

        res.json(updatedPost);
    } catch (error) {
        console.error("Error liking post:", error);
        res
            .status(500)
            .json({ message: "An error occurred while liking the post" });
    }
});

//endpoint to unlike a post
app.put("/posts/:postId/:userId/unlike", async (req, res) => {
    const postId = req.params.postId;
    const userId = req.params.userId;

    try {
        const post = await Post.findById(postId).populate("user", "name");

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $pull: { likes: userId } },
            { new: true }
        );

        updatedPost.user = post.user;

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }

        res.json(updatedPost);
    } catch (error) {
        console.error("Error unliking post:", error);
        res
            .status(500)
            .json({ message: "An error occurred while unliking the post" });
    }
});

//endpoint to get all the posts
app.get("/get-posts", async (req, res) => {
    try {
        const posts = await Post.find()
            .populate("user", "name")
            .sort({ createdAt: -1 });

        res.status(200).json(posts);
    } catch (error) {
        res
            .status(500)
            .json({ message: "An error occurred while getting the posts" });
    }
});




app.get("/profile/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Error while getting the profile" });
    }
});