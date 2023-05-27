const socket = io("/");
const allowedEntities = [];



socket.on("connect", function () {
    console.log(socket.id)
})


function startStream(){
    let temp = {};
    allowedEntities.map(e=>temp[e]=true)
    navigator.mediaDevices.getUserMedia(temp).then(stream => {
        document.getElementById("video_players").srcObject = stream
    })
}

document.getElementById("start_video").addEventListener("click", function () {
    allowedEntities.push("video");
    document.getElementById("start_video").disabled = true;
    document.getElementById("stop_video").disabled = false;
    startStream();
})

document.getElementById("start_audio").addEventListener("click", function () {
    allowedEntities.push("audio");
    document.getElementById("start_audio").disabled = true;
    document.getElementById("stop_audio").disabled = false;
    startStream();
})

document.getElementById("stop_video").addEventListener("click", function () {
    let isFound = allowedEntities.find("video");
    if(isFound){
        allowedEntities.splice(allowedEntities.indexOf(isFound),1);
        document.getElementById("stop_video").disabled = true;
        document.getElementById("start_video").disabled = false;
    }
    startStream();
})

document.getElementById("stop_audio").addEventListener("click", function () {
    let isFound = allowedEntities.find("audio");
    if(isFound){
        allowedEntities.splice(allowedEntities.indexOf(isFound),1);
        document.getElementById("stop_audio").disabled = true;
        document.getElementById("start_audio").disabled = false;
    }
    startStream();
})
