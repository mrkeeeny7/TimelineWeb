
//current timeline variables
var currentMin = -50; //min year
var currentMax = 50; //max year
var currentScale = 100;
var currentMinScale;    // scope of visible events
var currentMaxScale;    // scope of visible events
var currentYear = 0;    //TODO this is a placeholder for 1BC

var tlEvents = [];

var sliderScale;
const minScale = 10;        //years
const maxScale = 1e10;      //years
var minZoom = Math.log(minScale / 500.0);
var maxZoom = Math.log(maxScale / 500.0);


class TimelineEvent {
    constructor(domElement, date)
    {
        this.domElement = domElement; //html element
        this.date = date;
    }
}


//magic numbers
var mousewheelscrollfactor = 0.003;


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
    //var eventsString = "";
    //eventsString += jsonObj.category + ": ";

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

/**
 * 
 * @param {TimelineEvent} tlEvent the timeline event to move
 * @param {number} heightFactor the y-position to set as a fraction of the overall range, in the range [0,1]
 */
function setPosition(tlEvent, heightFactor)

{
    tlEvent.domElement.style.top = (heightFactor*100) + "%";
    //TODO to center the element vertically will have to offset 1/2 of the element's height
}

function refresh() {
    currentMin = currentYear - currentScale/2;
    currentMax = currentYear + currentScale/2;

    //position all events correctly on the timeline
    for(var i=0; i<tlEvents.length; i++)
    {
        //1. determine offset from current year

        var scalefactor = 1.0/currentScale;
        var offset = (tlEvents[i].date - currentYear) * scalefactor + 0.5;
        setPosition(tlEvents[i], offset);
        //console.log("offset: " + offset);
    }
}



//handle mousewheel scaling
function myWheelHandler(event)
{   
    var y = event.deltaY;
    sliderScale = TimelineScaleToSliderScale(currentScale);
    sliderScale += y * mousewheelscrollfactor;
    currentScale = SliderScaleToTimelineScale(sliderScale);
    //clamp scale
    currentScale = Math.min(currentScale, maxScale);
    currentScale = Math.max(currentScale, minScale);

    console.log("New scale: " + currentScale);
    refresh();
}


function SliderScaleToTimelineScale(sliderVal)
{
    var zoomlevel = sliderVal * (maxZoom - minZoom) + minZoom;
    var timelineVal = 500.0 * Math.exp (zoomlevel);

    return timelineVal;
}


function TimelineScaleToSliderScale(timelineVal)
{
    var zoomlevel = Math.log (timelineVal / 500.0);
    var sliderVal = ((zoomlevel - minZoom) / (maxZoom - minZoom));

    return sliderVal;
}



//handle timeline dragging
var isDragging = false;
var mouseDownY;
var oldCurrentYear=currentYear;

function timelineMouseDown(event)
{
    mouseDownY = event.pageY;
    isDragging = true;
}

function timelineMouseMove(event)
{
    if(isDragging)
    {        
		var dragAmount = (event.pageY - mouseDownY);
		DragTimeline (dragAmount);
    }
}

function timelineMouseUp(event)
{
    FinishDrag();
}

function DragTimeline(dragAmount){
    var dragScale = currentScale / 500.0; //scale the dragging speed with the timeline scale

    var draggedYearsAmount = dragScale * dragAmount;

    currentYear = oldCurrentYear - draggedYearsAmount ;


    console.log("Dragged " + draggedYearsAmount + " years");
    console.log("Curent year: " + currentYear);
    refresh();

}

function FinishDrag(){
    oldCurrentYear = currentYear;
    isDragging = false;
}