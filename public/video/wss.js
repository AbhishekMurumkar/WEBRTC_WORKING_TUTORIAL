let mySocket = null;
export const registerSocketEvents = (socket)=>{
    mySocket = socket;
    socket.on("connect",()=>{

    });
    socket.on("disconnect",()=>{});
    socket.on("pre-offer",()=>{

    });
    socket.on("pre-offer-answer",()=>{});
    socket.on("user-hung-up",()=>{});
    socket.on("webrtc-signaling",()=>{});

    const peerConnection =()=>{
        peerConnection = new RTCPeerConnection({iceServers:[
            {urls:"stun:stun.l.google.com:19302"}
        ]})
        peerConnection.ondatachannel = (event)=>{
            const channel = event.channel;
            channel.onopen = ()=>{
                console.log("channel opened");
            }
            channel.onmessage = (event)=>{
                const message = JSON.parse(event.data);
                console.log("got message from data channel: " + message)
            }
        }
        peerConnection.onicecandidate = (event)=>{
            if(event.candidate){
                console.log("got candidate", event.candidate);
                mySocket.emit('webrtc-signaling',JSON.stringify(event.candidate))
            }
        }
        const remoteTrack = new MediaStreamTrack();
        peerConnection.ontrack = (event)=>{
            remoteTrack.addTrack(event.track);
            console.log("got remote track", remoteTrack);
        }
    }
}

export const sendPreOffer = (offer)=>{
    mySocket.emit('pre-offer',offer)
}
export const sendPreOfferAnswer = (offer)=>{
    mySocket.emit('pre-offer-answer',offer)
}
export const sendDataUsingWebRTCSignaling = (offer)=>{
    mySocket.emit('webrtc-signaling',offer)
}
export const sendUserHungUp = (offer)=>{
    mySocket.emit('user-hung-up',offer)
}
