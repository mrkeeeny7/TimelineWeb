
//current timeline variables
var currentMin; //min year
var currentMax; //max year
var currentScale;
var currentMinScale;    // scope of visible events
var currentMaxScale;    // scope of visible events
var currentYear;

//html elements
var eventBubbles = [];


// Test function
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
    xmlhttp.open("GET", "timelines/events_rome.json", true);
    xmlhttp.send();
}

function createEventBubbles(jsonObj)
{
    var eventsString = "";
    eventsString += jsonObj.category + ": ";

    //clear exisiting stuff
    document.getElementById("mainTable").innerHTML="";

    for(var i=0; i<jsonObj.eventlist.length; i++)
    {
        var eventDate = dateIntGregorian(jsonObj.eventlist[i].dateString) ;

    //    eventsString += jsonObj.eventlist[i].title + ", ";

    //    eventsString += "<div class=\"eventBubble\" startDate=\"" + jsonObj.eventlist[i].date + "\">"        
    //    + jsonObj.eventlist[i].title    + "  " + eventDate
    //    + "</div>";

        var newEvent = document.createElement("div");
        newEvent.setAttribute("class", "eventBubble");
        newEvent.setAttribute("startDate", eventDate);
        newEvent.appendChild(document.createTextNode(jsonObj.eventlist[i].title    + "  " + eventDate));
        document.getElementById("mainTable").appendChild(newEvent);

        //save a reference
        eventBubbles.push(newEvent);
    }
    //document.getElementById("mainTable").innerHTML = eventsString;

}

function dateIntGregorian(dateString)
{
    var tokens = dateString.split(" ");
    if(tokens[1] && tokens[1].toLowerCase() == "bc")
    {
        return tokens[0] * -1; //TODO this is temprary - it will cause an off by 1 error when calculating date differences
    }
    else
    {
        return tokens[0]
    }
}


function appendData(data) {
    var mainContainer = document.getElementById("mainTable");
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = 'Name: ' + data[i].firstName + ' ' + data[i].lastName;
        mainContainer.appendChild(div);
    }
}


