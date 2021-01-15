
function myfunc()
{
    document.getElementById("mainTable")
    .innerHTML = "Testing";
}

function parseJSON()
{
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var jsonObj = JSON.parse(this.responseText);    //TODO try adding the reviver function here
            createEventBubbles(jsonObj);
        }
    };
    xmlhttp.open("GET", "timelines/timeline.json", true);
    xmlhttp.send();
}

function createEventBubbles(jsonObj)
{
    var eventsString = "";
    eventsString += jsonObj.category + ": ";

    for(var i=0; i<jsonObj.eventlist.length; i++)
    {
        //eventsString += jsonObj.eventlist[i].title + ", ";

        eventsString += "<div class=\"eventBubble\" startDate=\"" + jsonObj.eventlist[i].date + "\">"
        
        + jsonObj.eventlist[i].title    + "  " +   + jsonObj.eventlist[i].date   
        + "</div>";
    }
    document.getElementById("mainTable").innerHTML = eventsString;

}


function appendData(data) {
    var mainContainer = document.getElementById("mainTable");
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = 'Name: ' + data[i].firstName + ' ' + data[i].lastName;
        mainContainer.appendChild(div);
    }
}


