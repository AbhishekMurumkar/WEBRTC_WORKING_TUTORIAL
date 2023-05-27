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
let peerConnections = [];
console.log("socketId: " + socket.id);

socket.on("connect", function () {
    console.log("socketId: " + socket.id);
    store.socketId = socket.id;
});
socket.on("pre-offer", data => {
    console.log("pre-offer", data);
    let mydata = {
        callType: 'CALL_ACCEPTED',
        source: data.destination,
        destination: data.source
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
    let peerConnection = peerConnections[peerConnections.length - 1];
    console.log("webrtc-signalling",data.type);
    if (data.type == 'OFFER') {
        console.log("GOT - webrtc-signalling - OFFER");

        console.log("About to set remote description: offer :",data.offer, peerConnection)
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log("fired - webrtc-signalling - ANSWER");
        socket.emit('webrtc-signalling', {
            type: 'ANSWER',
            answer: answer,
            source: data.destination,
            destination: data.source
        });
    }
    else if (data.type === 'ANSWER') {
        console.log("GOT - webrtc-signalling - ANSWER");
        console.log(peerConnection, data);
        try {
            console.log("About to set remote description: answer :",data.offer, peerConnection)
            await peerConnection.setRemoteDescription(data.answer);
        } catch (err) {
            console.log("unable to set remote answer");
            console.log(err, err.stack);
        }
        console.log("SET ANSWER COMPLETE");
    }
    else if (data.type === 'ICE_CANDIDATE') {
        gotCandidates++;
        console.log("GOT - webrtc-signalling - ICE_CANDIDATE " + gotCandidates);
        await peerConnection.addIceCandidate(data.candidate);
    } else {
        console.log("err", data);
    }
})
socket.on("user-joined",user=>{
    console.log("user-joined",user);
    if(user.name!=UserDetails.name){
        socket.emit('pre-offer', {
            callType: 'PERSONAL_VOICE CALL',
            source: socket.id,
            destination: user.roomId
        })
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
    console.log("fired pre-offer");
    socket.emit('pre-offer', {
        callType: 'PERSONAL_VOICE CALL',
        source: data.destination,
        destination: data.source,
        channelId: data?.channelId || null,
    })
}
async function throwWebRtcOffer(data){
    console.log("fired - webrtc-signalling - OFFER", data);
    let peerConnection = peerConnections[peerConnections.length - 1];
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc-signalling', {
        offer: offer,
        source: data.destination,
        destination: data.source,
        type: 'OFFER'
    });
}

document.getElementById("startNewChannel").addEventListener("click", (event) => {
    event.preventDefault();
    fetch('http://localhost:3000/video/createVideoLink', {
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
            // window.location.href = 'http://localhost:3000/video/joinVideoLink/'+data;
            localStorage.setItem('channelDetails', data);
            console.log(data)
            data = JSON.parse(atob(data));
            console.log(data)
            startSelfStream();
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
    fetch("http://localhost:3000/video/verifyMeeting", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingsdata)
    }).catch(error => console.error(error))
    .then(function (response) {
        return response.json()
    })
    .then(data=>{
        console.log(data)
        startSelfStream();
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
async function startSelfStream() {
    document.getElementById('video-join-dashboard').style.display = 'none';
    document.getElementById('meeting_room').style.display = 'block';
    await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
    }).then(stream => {
        store.localStream = stream;
        console.log("got stream",stream)
        // store.localStream.getTracks().forEach(track => {
        //     track.stop();
        // });
        const videoContainer = document.getElementById("video_container");
        const video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        videoContainer.appendChild(video);
    });
}
async function createPeerConnection(data) {
    await startSelfStream();
    console.log("in createPeerConnection",store)
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    });
    let dataChannel = peerConnection.createDataChannel("chat");
    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onopen = () => {
            console.log("channel opened");
        };
        channel.onmessage = event => {
            console.log(event.data);
        };
    }
    peerConnection.oniceconnectionstatechange = event => {
        console.log(event.target.iceConnectionState);
    };
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('webrtc-signalling', {
                candidate: event.candidate,
                source: data.destination,
                destination: data.source,
                type: 'ICE_CANDIDATE'
            });
            firedCandidates++;
            console.log("fired - webrtc-signalling - ICE_CANDIDATE", firedCandidates);
        }
    };
    let remoteStream = new MediaStream();
    store.remoteStreams.push(remoteStream);
    let streamElement = document.createElement('video');
    streamElement.autoplay = true;
    streamElement.playsInline = true;
    streamElement.srcObject = remoteStream;
    document.getElementById('video_container').appendChild(streamElement);
    peerConnection.ontrack = event => {
        remoteStream.addTrack(event.track);
    };
    peerConnection.onremovetrack = event => {
        store.localStream.removeTrack(event.track);
    };

    peerConnection.onaddstream = event => {
        store.remoteStreams.push(event.stream);
    };
    peerConnection.onremovestream = event => {
        store.remoteStreams.splice(store.remoteStreams.indexOf(event.stream), 1);
    };
    const localStream = store.localStream;console.log("localTracks", localStream, localStream.getTracks());
    for(const track of localStream.getTracks()){
        peerConnection.addTrack(track, localStream);
    }

    peerConnections.push(peerConnection);
    console.log(peerConnections, peerConnection);
}

