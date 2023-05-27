const express= require("express");
// const { ExpressPeerServer } = require("peer");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
// const peerServer = ExpressPeerServer(server,{debug:true});
app.use(express.static("public"));
app.use(express.json());

let availableUsers = [];
let channelsInfo = {};

// app.use("/peerjs",peerServer);
/**
 * for default lets ask name and then show to join a room or create a new one
 */
app.get("/video",(req,res)=>{
    res.sendFile("/video/index.html");
});
/**
 * endpoint to list to  user from server instance
 */
app.get("/getAllUsers",(req,res)=>{});
/**
 * for create a new one
 * -> generate meeting id
 * -> generate password for meeting
 */
app.post("/video/createVideoLink",(req,res)=>{
    const uuid = require("uuid");
    const generator = require('generate-password');
    const password = generator.generateMultiple(1, {
        length: 12,
        uppercase: true,
        numbers: true,
        symbols: true,
        excludeSimilarCharacters:true
    })[0];
    console.log("createVideoLink",req.body);
    let channelPayload = {
        id: uuid.v4().toString(),
        createdBy: req.body.email,
        password: password
    }
    channelsInfo[channelPayload.id] = channelPayload;
    console.log("channelsInfo",channelsInfo);
    return res.status(200).send(Buffer.from(JSON.stringify(channelPayload)).toString('base64'));
});
/**
 * for join one 
 * -> ask for meeting id and password
 * -> if valid move ahead
 * -> else go back to root with error
 */
app.get("/video/joinVideoLink/:token",(req,res)=>{
    if(!req.params.token){
        return res.status(400).send("Missing Token");
    }
    try{
        let channelPayload = Buffer.from(req.params.token,'base64').toString();
        channelPayload = JSON.parse(channelPayload);
        console.log("joinVideoLink,",channelPayload);
        console.log("channelsInfo",channelsInfo);
        console.log("channelPayload with id",channelsInfo[channelPayload.id])
        if(!channelsInfo.hasOwnProperty(channelPayload.id)){
            return res.status(400).send("No Such Channel Found"); 
        }
        let dataFromServer = channelsInfo[channelPayload.id];
        if(dataFromServer.password != channelPayload.password || dataFromServer.id != channelPayload.id){
            return res.status(400).send("Token Invalidated");
        }else{
            return res.status(200).sendFile(__dirname+"/public/video/meeting.html");
        }
    }catch(err){
        console.log(err)
        return res.status(400).send("Token Invalidated");
    }
});
app.post("/video/verifyMeeting", function(req, res){
    try{
        let content = req.body;
        if(!channelsInfo[content.meetingId]) return res.status(404).send("No channel with given id was found");
        let dataFromServer = channelsInfo[content.meetingId];
        if(dataFromServer.password != content.password){
            return res.status(400).send("Invalid credentials");
        }else{
            res.status(200).send(true)
        }
    }catch(err){
        console.log(err)
        return res.status(400).send("Token Invalidated");
    }
})
/**
 * after call is done lets delete the meeting links based on type
 */
app.post("/video/deleteVideoLink",(req,res)=>{});

app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!")
})



/************************************************************* */

io.on("connection", function(socket){
    availableUsers.push(socket.id);
    console.log("got a connection",socket.id,availableUsers);
    socket.on("disconnect", function(){
        let userData = availableUsers.find(user => user.id === socket.id);
        if(userData){
            userData['status'] = 'offline';
            userData['socketId'] = null;
        }
        availableUsers = availableUsers.filter(user => user!== socket.id);
        console.log("After disconnected",availableUsers);
    });

    socket.on("addUserDetails", function(data){
        let isExistingUser = availableUsers.find(user => user.email === data.email);
        if(isExistingUser){
            console.log("found existing user")
            isExistingUser['status'] = 'available';
            isExistingUser['socketId'] = socket.id;
        }else{
            console.log("creating new user")
            let userData = {
                socketId: socket.id,
                name: data.name,
                email: data.email,
                status: 'available',
                socketId: socket.id,
                addedOn: new Date().getTime(),
            }
            availableUsers.push(userData);
            console.log("After adding",availableUsers);
            delete userData['socketId'];
            isExistingUser = userData;
        }
        io.emit('online', isExistingUser);
    });

    socket.on("createChannel", function(data){
        let channel = {
            id : data.id,
            createdBy : data.name,
            password : data.password,
            createdOn: new Date().getTime(),
        }
        createdChannels[channel.id] = channel;
        channelsInfo.push(channel);
    })

    socket.on("pre-offer",function(data) {
        socket.to(data.destination).emit("pre-offer",data);
    })

    socket.on('pre-offer-answer',data=>{
        socket.to(data.destination).emit("pre-offer-answer",data);
    })

    socket.on('webrtc-signalling',(data)=>{
        socket.to(data.destination).emit("webrtc-signalling",data);
    })

    socket.on("user-hanged-up",data=>{
        const connectedPeer = availableUsers.find(user=>data.socketId==user);
        if(connectedPeer){
            socket.to(data.channelId).emit("user-hanged-up",data);
        }
    })

    socket.on("join-user",function(data){
        socket.to(data.destination).emit("join-user",data);
    })

    socket.on("join-user-accepted",function(data){
        socket.to(data.destination).emit("join-user-accepted",data);
    })

    socket.on("join-room",user=>{
        console.log("join-room",user)
        socket.join(user.roomId);
        socket.to(user.roomId).emit("user-joined",user);
    })
})


server.listen(3000,()=>{
    console.log("server is running on port 3000");
});
