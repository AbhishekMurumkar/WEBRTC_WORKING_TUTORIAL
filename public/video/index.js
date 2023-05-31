const socket = io("/");


let user = null;
let UserDetails = {
    name: '',
    email: ''
}
let store = {
    socketId: null,
    localStream: null,
    remoteStreams: [],
    screenSharingActive: false,
    screenSharingStream: null
};
let connectedUsers = [];
let peerConnections = {};

socket.on("connect", function () {
    console.log("socketId: " + socket.id);
    connectedUsers.push(socket.id);
    store.socketId = socket.id;
});
socket.on("pre-offer", data => {
    console.log("pre-offer", data);
    let mydata = {
        ...data,
        callType: 'CALL_ACCEPTED',
        source: data.destination,
        destination: data.source,
        socketId: socket.id
    }
    console.log("fired pre-offer-answer", mydata)
    createPeerConnection(data);//destination
    socket.emit('pre-offer-answer', mydata);
});
socket.on("pre-offer-answer", async (data) => {
    console.log("pre-offer-answer", data);//initiator
    if (data.callType == 'CALL_ACCEPTED') {
        await createPeerConnection(data);//initiator
        await throwWebRtcOffer(data);
    }
})
socket.on("join-user", data => {
    console.log("requesting a call from", data);
    let acceptance = prompt("User: " + data.name + " is calling");
    let myData = {
        ...data,
        "source": data.destination,
        "destination": data.source
    }
    if (acceptance == null) {
        socket.emit("join-user-declined", myData)
    } else {
        console.log("fired join-user-accepted ", myData);
        socket.emit("join-user-accepted", myData)
    }
})
socket.on("join-user-declined", data => {
    console.log("from join-user-declined", data);
})
socket.on("join-user-accepted", data => {
    console.log("GOT join-user-accepted", data);
    throwOffer(data);
})
let gotCandidates = 0;
socket.on("webrtc-signalling", async (data) => {
    try{
        console.log("webrtc-signalling",data.type,data);
        let peerConnection = null;
        if(peerConnections[data.socketId]){
            peerConnection = peerConnections[data.socketId];
        }else{
            await createPeerConnection(data);
            peerConnection = peerConnections[data.socketId];
        }
        console.log("->found peerConnection for "+data.socketId+":"+Boolean(peerConnection));
        if (data.type == 'OFFER') {
            console.log("GOT - webrtc-signalling - OFFER :: About to set remote description: offer");
            await peerConnection.setRemoteDescription(data.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log("fired - webrtc-signalling - ANSWER");
            socket.emit('webrtc-signalling', {
                ...data,
                type: 'ANSWER',
                answer: answer,
                source: data.destination,
                destination: data.source,
                socketId: socket.id
            });
        }
        else if (data.type === 'ANSWER') {
            console.log("GOT - webrtc-signalling - ANSWER :: About to set remote description: answer");
            try {
                await peerConnection.setRemoteDescription(data.answer);
                console.log("SET ANSWER COMPLETE");
            } catch (err) {
                console.log("unable to set remote answer");
                console.log(err, err.stack);
            }
        }
        else if (data.type === 'ICE_CANDIDATE') {
            gotCandidates++;
            console.log("GOT - webrtc-signalling - ICE_CANDIDATE " + gotCandidates);
            await peerConnection.addIceCandidate(data.candidate);
        } else {
            console.log("err", data);
        }
    }catch(err){
        console.log("Error in receiving webrtc-signalling")
        console.log(err, err.stack);
        console.log(data);
    }
})
socket.on("user-joined",user=>{
    console.log("user-joined",user);
    // document.getElementById("video_container").innerHTML = "";
    if(user.name!=UserDetails.name){
        let myData = {
            callType: 'PERSONAL_VOICE CALL',
            source: socket.id,
            destination: user.socketId,
            socketId: socket.id
        }
        console.log("fired pre-offer",myData);
        socket.emit('pre-offer', myData)
        connectedUsers.push(user.socketId);
    }
})


document.getElementById("joinNewChannel").addEventListener("click", (event) => {
    document.getElementById("show-existing-join").style.display = 'block';
});
document.getElementById("joinUser").addEventListener("click", (event) => {
    document.getElementById("show-existing-user-join").style.display = 'block';
})
document.getElementById("video-dashboard-submit-user").addEventListener("click", (event) => {
    event.preventDefault();
    let userId = document.getElementById("existingUserId").value;
    console.log("fired join-user")
    socket.emit('join-user', {
        source: socket.id,
        destination: userId,
        ...UserDetails
    });
})
function throwOffer(data) {
    let mydata = {
        callType: 'PERSONAL_VOICE CALL',
        source: data.destination,
        destination: data.source,
        channelId: data?.channelId || null,
    }
    console.log("fired pre-offer",mydata);
    socket.emit('pre-offer', mydata);
}
async function throwWebRtcOffer(data){
    let peerConnection = peerConnections[data.socketId];
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    let mydata = {
        ...data,
        offer: offer,
        source: data.destination,
        destination: data.source,
        type: 'OFFER',
        socketId: socket.id
    }
    console.log("fired - webrtc-signalling - OFFER", mydata);
    socket.emit('webrtc-signalling', mydata);
}

document.getElementById("startNewChannel").addEventListener("click", (event) => {
    event.preventDefault();
    fetch('https://vid.dev.us-con-aws-sbx.com:5000/video/createVideoLink', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(socket.userDetails)
    })
        .then(data => {
            return data.text()
        })
        .then(data => {
            // window.location.href = 'https://vid.dev.us-con-aws-sbx.com:5000/video/joinVideoLink/'+data;
            localStorage.setItem('channelDetails', data);
            console.log(data)
            data = JSON.parse(atob(data));
            console.log(data)
            document.getElementById('MymeetingId').value = data.id;
            document.getElementById('MymeetingPass').value = data.password;
            createPeerConnection({socketId:socket.id});
            let content = {
                roomId: data.id,
                ...UserDetails
            }
            socket.emit('join-room',content);
        })
        .catch(function (error) {
            console.log(error.stack)
        })
});
document.getElementById('video-dashboard-submit').addEventListener('click', function (event) {
    event.preventDefault();
    let meetingsdata = {}
    meetingsdata['name'] = document.getElementById("name").value;
    meetingsdata['email'] = document.getElementById("email").value;
    meetingsdata['meetingId'] = document.getElementById("existingMeetingId").value;
    meetingsdata['password'] = document.getElementById("existingMeetingPassword").value;
    fetch("https://vid.dev.us-con-aws-sbx.com:5000/video/verifyMeeting", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingsdata)
    }).catch(error => console.error(error))
    .then(function (response) {
        return response.json()
    })
    .then(async(data)=>{
        console.log(data)
        document.getElementById('MymeetingId').value = meetingsdata.meetingId;
        document.getElementById('MymeetingPass').value = meetingsdata.password;
        await createPeerConnection({socketId:socket.id})
        let content = {
            roomId: meetingsdata['meetingId'],
            ...UserDetails
        }
        socket.emit('join-room',content);
    });
})
document.getElementById('submit').addEventListener("click", (event) => {
    event.preventDefault();
    let data = {};
    data['name'] = document.getElementById("name").value;
    UserDetails['name'] = data['name'];
    data['email'] = document.getElementById("email").value;
    UserDetails['email'] = data['email'];
    socket['userDetails'] = {};
    socket['userDetails'] = data;
    socket.emit('addUserDetails', data);
    document.getElementById("getUserDetails").style.display = 'none';
    document.getElementById("video-join-dashboard").style.display = 'block';
})
document.getElementById("stop_video").addEventListener("click", function () {
    const localStream = store.localStream;
    const cameraEnabled = localStream.getVideoTracks()[0].enabled;
    localStream.getVideoTracks()[0].enabled = !cameraEnabled;
    let buttonText = !cameraEnabled ? 'Stop Camera' : 'Start Camera';
    document.getElementById("stop_video").textContent = buttonText;
})
document.getElementById("stop_audio").addEventListener("click", function () {
    const localStream = store.localStream;
    console.log(localStream)
    const audioEnabled = localStream.getAudioTracks().length;
    localStream.getAudioTracks()[0].enabled = !audioEnabled;
    let buttonText = !audioEnabled ? 'Stop Mic' : 'Start Mic';
    document.getElementById("stop_audio").textContent = buttonText;
});

let firedCandidates = 0;
async function startSelfStream(data) {
    console.log("startSelfStream",data);
    document.getElementById('video-join-dashboard').style.display = 'none';
    document.getElementById('meeting_room').style.display = 'block';
    return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
    })
    // .then(stream => {
    //     store.localStream = stream;
    //     console.log("got stream",stream)
    //     // store.localStream.getTracks().forEach(track => {
    //     //     track.stop();
    //     // });
    //     // const videoContainer = document.getElementById("video_container");
    //     // const video = document.createElement("video");
    //     // video.srcObject = stream;
    //     // video.autoplay = true;
    //     // video.playsInline = true;
    //     // videoContainer.appendChild(video);
    //     appendVideoDiv(data,stream);
    //     return stream;
    // });
}
function appendVideoDiv(data,stream){
    console.log("appendVideoDiv",data);
    const divElement = document.createElement('div');
    const videoElement = document.createElement('video');
    const pElement = document.createElement('p');
    pElement.textContent = data.socketId;
    pElement.className = "video_title_div";
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.className = "video_player_div";
    divElement.className = "video_div";
    divElement.appendChild(pElement);
    divElement.appendChild(videoElement);
    document.getElementById('video_container').appendChild(divElement);
}
document.getElementById('copyMeetingId').addEventListener('click',(event) =>{event.preventDefault();copyToClipboard(1)})
document.getElementById('copyMeetingPass').addEventListener('click',(event) =>{event.preventDefault();copyToClipboard(2)})
function copyToClipboard(data){
    let text = (data==1)?(document.getElementById('MymeetingId')):(document.getElementById('MymeetingPass'))
    navigator.clipboard.writeText(text.value);
    console.log("copied"+text.value);
}
async function createPeerConnection(data) {
    console.log("in createPeerConnection",data, connectedUsers)
    let remoteStream;
    if(data.socketId!=socket.id){
        remoteStream = new MediaStream();
        store.remoteStreams.push(remoteStream);
        console.log(1, remoteStream);
    }else{
        remoteStream = await startSelfStream(data);
        store.localStream=remoteStream;
        console.log(2, remoteStream);
    }
    appendVideoDiv(data, remoteStream);
    const config = {
        iceServer: [
            {
                urls: "stun:stun.l.google.com:19302"
            },
            {
                url: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            }            
        ]
    };
    const peerConnection = new RTCPeerConnection(config);
    console.log("pushing a new connection for "+data.socketId);
    peerConnections[data.socketId]=peerConnection;
    console.log(peerConnections, peerConnection);
    let dataChannel = peerConnection.createDataChannel("chat");
    peerConnection.ontrack = event => {
        remoteStream.addTrack(event.track);
    };
    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onopen = () => {
            console.log("channel opened");
        };
        channel.onmessage = event => {
            console.log(event.data);
        };
    }
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            firedCandidates++;
            let mydata = {
                candidate: event.candidate,
                source: data.destination,
                destination: data.source,
                type: 'ICE_CANDIDATE',
                firedCandidates,
                socketId:socket.id
            };
            console.log("fired - webrtc-signalling - ICE_CANDIDATE", firedCandidates, mydata);
            socket.emit('webrtc-signalling', mydata);
        }
    };

    // let streamElement = document.createElement('video');
    // streamElement.autoplay = true;
    // streamElement.playsInline = true;
    // streamElement.srcObject = remoteStream;
    // document.getElementById('video_container').appendChild(streamElement);
    peerConnection.onremovetrack = event => {
        store.localStream.removeTrack(event.track);
    };

    peerConnection.onaddstream = event => {
        store.remoteStreams.push(event.stream);
    };
    peerConnection.onremovestream = event => {
        store.remoteStreams.splice(store.remoteStreams.indexOf(event.stream), 1);
    };
    peerConnection.oniceconnectionstatechange = event => {
        console.log(event.target.iceConnectionState);
    };

    const localStream = store.localStream;
    console.log("localTracks", localStream);
    for(const track of localStream.getTracks()){
        peerConnection.addTrack(track, localStream);
    }

}

