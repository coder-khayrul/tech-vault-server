require('dotenv').config()
const express = require('express');

const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { authenticateUser } = require('./middlewares/authenticateUser');
const app = express()
const Stripe = require("stripe");
const stripe = new Stripe(process.env.PAYMENT_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pvi1q6h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // await client.connect();
        const productCollection = client.db("app_orbitdb").collection("products");
        const reviewCollection = client.db("app_orbitdb").collection("reviews");
        const userCollection = client.db("app_orbitdb").collection("users");
        const paymentCollection = client.db("app_orbitdb").collection("payments");
        const couponsCollection = client.db("app_orbitdb").collection("coupons")
        /****middlewares for verify admin  */
        const verifyRole = (roles) => {
            return (req, res, next) => {
                if (!roles.includes(req.user.role)) {
                    return res.status(403).json({ message: "Forbidden: Insufficient role" });
                }
                next();
            };
        };

        /***********middleware for verify jwt */
        const verifyJWT = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ message: "Unauthorized: No token" });
            }

            const token = authHeader.split(" ")[1];

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).json({ message: "Forbidden: Invalid token" });
                }
                req.user = decoded;
                next();
            });
        };



        /**** JWT token route */
        app.post("/jwt", async (req, res) => {
            try {
                const { email, name } = req.body;
                if (!email || !name) {
                    return res.status(400).json({ message: "Email and name are required" });
                }

                const existingUser = await userCollection.findOne({ email });

                const update = {
                    $set: {
                        email,
                        name,
                        role: existingUser?.role || "user",
                        last_login: new Date().toISOString(),
                    },
                };
                const options = { upsert: true };

                await userCollection.updateOne({ email }, update, options);


                const token = jwt.sign(
                    { email, role: existingUser?.role || "user" },
                    process.env.ACCESS_TOKEN_SECRET,
                    { expiresIn: "24h" }
                );


                res.send({ token });
            } catch (err) {
                console.error("JWT error:", err);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });


        /**** Profile route */
        app.get("/me", verifyJWT, async (req, res) => {
            try {
                const userEmail = req.user.email;
                console.log(userEmail)
                const user = await userCollection.findOne({ email: userEmail });

                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                const profile = {
                    email: user.email,
                    name: user.name || "",
                    role: user.role || "user",
                    last_login: new Date().toISOString(),
                };

                res.json(profile);
            } catch (err) {
                console.error("Profile fetch error:", err);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        app.get("/users", verifyJWT, verifyRole(["admin"]), async (req, res) => {
            try {
                const users = await userCollection.find().toArray();
                res.json(users);
            } catch (error) {
                console.error("Error fetching users:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        app.patch("/users/:id", async (req, res) => {
            try {
                const userId = req.params.id;
                const { role } = req.body;

                if (!role) {
                    return res.status(400).json({ error: "Role is required" });
                }

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { role } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: "User not found" });
                }

                res.json({ message: "User role updated successfully" });
            } catch (error) {
                console.error("Error updating user role:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        // ====================*****************=================
        app.get("/coupons", async (req, res) => {
            const coupons = await couponsCollection.find().toArray();
            res.json(coupons);
        });
        app.post("/coupons", async (req, res) => {

            const newCoupon = req.body;
            const result = await couponsCollection.insertOne(newCoupon);
            res.json({ success: true, insertedId: result.insertedId });

        });

        app.put("/coupons/:id", async (req, res) => {

            const id = req.params.id;
            const { _id, ...updatedData } = req.body;

            const result = await couponsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            );

            res.json({ success: true, modifiedCount: result.modifiedCount });

        });


        app.delete("/coupons/:id", async (req, res) => {

            const id = req.params.id;
            const result = await couponsCollection.deleteOne({ _id: new ObjectId(id) });
            res.json({ success: true, deletedCount: result.deletedCount });

        });
        app.post("/reviews", async (req, res) => {
            const newReview = req.body;
            newReview.timestamp = new Date().toISOString();
            const result = await reviewCollection.insertOne(newReview)
            res.send(result)
        })
        app.get("/reviews/:id", async (req, res) => {
            const id = req.params.id;
            const query = { productId: id };
            const cursor = reviewCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })
        app.get("/reviews", async (req, res) => {
            try {
                const reviews = await reviewCollection.find().toArray();
                res.json(reviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        app.get("/products/pending", async (req, res) => {
            const query = { status: "pending" };

            const cursor = productCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })
        app.put("/products/:id/accept", async (req, res) => {
            const { id } = req.params;
            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: "accepted" } }
            );
            res.json({ success: true, result });
        });

     
        app.put("/products/:id/reject", async (req, res) => {
            const { id } = req.params;
            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: "rejected" } }
            );
            res.json({ success: true, result });
        });

      
        app.put("/products/:id/feature", async (req, res) => {
            const { id } = req.params;
            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { featured: true } }
            );
            res.json({ success: true, result });
        });
        app.get("/products/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { ownerEmail: email };
            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.patch("/products/report/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    reported: true,
                    reportTimestamp: new Date().toISOString(),
                },
            };

            const result = await productCollection.updateOne(filter, update);
            res.send(result)
        });

        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result)
        })
        app.post("/products", async (req, res) => {
            const newProduct = req.body;
            const result = await productCollection.insertOne(newProduct)
            res.send(result)
        })
        app.get("/all-products/", async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get("/products", async (req, res) => {
            const search = req.query.search;
            const query = { status: "accepted" };

            if (search) {
                query.productName = { $regex: search, $options: "i" };
            }
            const cursor = productCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })
        app.put("/products/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateProduct = req.body;
            const updatedDoc = {
                $set: updateProduct
            }
            const result = await productCollection.updateOne(filter, updatedDoc, options)
            res.send(result)


        })
        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })
        app.get("/tranding-products", async (req, res) => {

            const trandingProducts = await productCollection
                .find({})
                .sort({ upvotes: -1 })
                .limit(6)
                .toArray();

            res.json(trandingProducts);
        })
        app.get("/featured-products", async (req, res) => {

            const featuredProducts = await productCollection
                .find({})
                .sort({ timestamp: -1 })
                .limit(4)
                .toArray();

            res.json(featuredProducts);
        })

        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const { userEmail } = req.body;

            const product = await productCollection.findOne({ _id: new ObjectId(id) });

            if (!product) return res.status(404).send({ message: "Product not found" });

            if (product.voters && product.voters.includes(userEmail)) {
                return res.status(400).send({ message: "User already voted" });
            }

            const updatedDoc = {
                $inc: { upvotes: 1 },
                $addToSet: { voters: userEmail }
            };

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                updatedDoc
            );

            res.send(result);
        });


        //********Payment system**** */
        app.post('/api/payment', async (req, res) => {
            try {
                const { paymentMethodId, amount, userEmail } = req.body;

                // Create PaymentIntent
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    receipt_email: userEmail,
                    currency: 'usd',
                    payment_method: paymentMethodId,
                    automatic_payment_methods: {
                        enabled: true,
                        allow_redirects: 'never'
                    },
                    confirm: true

                });

                if (paymentIntent.status === 'succeeded') {
                    res.json({ success: true, clientSecret: paymentIntent.client_secret });
                    const newPayment = req.body;
                    const result = await paymentCollection.insertOne(newPayment)
                    res.send(result)
                } else {
                    res.json({ success: false, error: 'Payment failed' });
                }
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        app.get("/api/user/:email", async (req, res) => {
            try {
                const user = await paymentCollection.findOne({ userEmail: req.params.email });
                if (!user) return res.status(404).json({ error: "User not found" });
                res.json(user);

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);





app.get("/", (req, res) => {
    res.send("WELCOME To APP ORBIT SERVER")
})

app.listen(port, () => {
    console.log("This Server is running on", port);
})