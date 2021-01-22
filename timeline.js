
//current timeline variables
var currentMin = -50; //min year
var currentMax = 50; //max year
var currentScale;
var currentMinScale;    // scope of visible events
var currentMaxScale;    // scope of visible events
var currentYear = 0;    //TODO this is a placeholder for 1BC

var tlEvents = [];

class TimelineEvent {
    constructor(domElement, date)
    {
        this.domElement = domElement; //html element
        this.date = date;
    }
}



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

        var newEventDomElement = document.createElement("div");
        newEventDomElement.setAttribute("class", "eventBubble");
        newEventDomElement.setAttribute("startDate", eventDate);
        newEventDomElement.appendChild(document.createTextNode(jsonObj.eventlist[i].title    + "  " + eventDate));
        document.getElementById("mainTable").appendChild(newEventDomElement);

        var newEvent = new TimelineEvent(newEventDomElement, eventDate);
        //setPosition(newEvent, 0.5);
        //save a reference
        tlEvents.push(newEvent);
    }
    //document.getElementById("mainTable").innerHTML = eventsString;
    refresh();

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

function setPosition(tlEvent, heightFactor) {
    tlEvent.domElement.style.top = (heightFactor*100) + "%";
}

function refresh() {
    //position all events correctly on the timeline
    for(var i=0; i<tlEvents.length; i++)
    {
        //1. determine offset from current year

        var scalefactor = 1.0/(currentMax - currentMin);
        var offset = (tlEvents[i].date - currentYear) * scalefactor + 0.5;
        setPosition(tlEvents[i], offset);
        console.log("offset: " + offset);
    }
}

