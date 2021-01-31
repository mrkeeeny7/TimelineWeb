
//current timeline variables
var currentMin = -50; //min year
var currentMax = 50; //max year
var currentScale = 100;
var currentMinScale;    // scope of visible events
var currentMaxScale;    // scope of visible events
var currentYear = 0;    //TODO this is a placeholder for 1BC

var tlEvents = [];
var currentSelectedEvent;

var sliderScale;
const MIN_SCALE = 10;        //years
const MAX_SCALE = 1e10;      //years
var minZoom = Math.log(MIN_SCALE / 500.0);
var maxZoom = Math.log(MAX_SCALE / 500.0);

const TIMELINES_SELECTOR_FILE = "timelines/timeline_list.json";
const MEGA_ANNUM = 1000000; //1 million yrs = 1 Ma
const MEGA_ANNUM_THRESHOLD = 100000; //0.1 Ma


class TimelineEvent {
    constructor(title, domElement, date)
    {
        this.title = title;
        this.domElement = domElement; //html element
        this.date = Number(date);
    }
}
function compareTimelineEvents(a,b)
{
    return a.date - b.date;
}

//magic numbers
const MWHEEL_SCROLL_FACTOR = 0.003;


// Test function
function myfunc()
{
    document.getElementById("mainTable")
    .innerHTML = "Testing";
}

function loadSelectorOptions()
{
    console.log("Loading selector options");
    loadJSON(TIMELINES_SELECTOR_FILE, createSelectorOptions);
}

function createSelectorOptions(jsonObj)
{    
    var selectorDOM = document.getElementById("timelineSelect");

    //clear existing options
    selectorDOM.innerHTML="";
    for(var i=0; i<jsonObj.timelinelist.length; i++)
    {        
        var newSelectorOption = document.createElement("option");
        newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].filename);      //set the value as filename so we can use it when selecting
        //newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].title);
        newSelectorOption.appendChild(document.createTextNode(jsonObj.timelinelist[i].title));
        selectorDOM.appendChild(newSelectorOption);
    }

}

function timelineSelectorChanged()
{    
    var selectorDOM = document.getElementById("timelineSelect");
    loadTimeline(selectorDOM.value, true);
}

function loadTimeline(timelineFile) //TODO add option to recentre/scale timeline
{
    console.log("Loading from " + timelineFile);
    loadJSON(timelineFile, createEventBubbles, true);

}

function loadJSON(jsonfile, onFinishCallback, recentre)
{
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() 
    {
        if (this.readyState == 4) {     //response ready
            if( this.status == 200)     //"OK"
            {
                var jsonObj = JSON.parse(this.responseText);    //TODO try adding the reviver function here
                onFinishCallback(jsonObj);
            }
            else if(this.status == 404)
            {
                console.log("Resource not found: " + jsonfile);
                //TODO put another callback to display on the page
                //TODO add a waiting icon to show timeline is loading
            }
            else
            {
                console.log("Error loading resource " + jsonfile + ": " + this.statusText);
            }
        }
    };
    xmlhttp.open("POST", jsonfile, true); //currently using POST to avoid caching; TODO look into best options for this
    xmlhttp.send();
}


function createEventBubbles(jsonObj)
{
    //var eventsString = "";
    //eventsString += jsonObj.category + ": ";

    //clear exisiting stuff
    tlEvents = [];
    //document.getElementById("mainTable").innerHTML="";

    //remove existing eventBubbles
    var bubbles = document.getElementsByClassName("eventBubble");
    for(i=bubbles.length-1; i>=0; i--) //go from the end backwards to avoid weird iteration bugs
    {
        bubbles[i].remove();
    }
    


    for(var i=0; i<jsonObj.eventlist.length; i++)
    {
        var eventDate = dateIntGregorian(jsonObj.eventlist[i].dateString) ;
        var eventIndex = i;

    //    eventsString += jsonObj.eventlist[i].title + ", ";

    //    eventsString += "<div class=\"eventBubble\" startDate=\"" + jsonObj.eventlist[i].date + "\">"        
    //    + jsonObj.eventlist[i].title    + "  " + eventDate
    //    + "</div>";

        var newEventDomElement = document.createElement("div");
        newEventDomElement.setAttribute("class", "eventBubble");
        newEventDomElement.setAttribute("startDate", eventDate);
        newEventDomElement.setAttribute("selected", false);
        newEventDomElement.setAttribute("eventIndex", eventIndex);
        newEventDomElement.appendChild(document.createTextNode(jsonObj.eventlist[i].title    + "  " + dateString(eventDate)));

        var newEvent = new TimelineEvent(jsonObj.eventlist[i].title, newEventDomElement, eventDate);
        newEventDomElement.addEventListener("click", onEventClick);
        
        //save a reference
        tlEvents.push(newEvent);

        // add to the document
        document.getElementById("mainTable").appendChild(newEventDomElement);
    }
    //document.getElementById("mainTable").innerHTML = eventsString;
    SortEventsList();
    recentreTimeline();
    refresh();

}

function SortEventsList()
{
    tlEvents.sort(compareTimelineEvents);
    //re-index the list
    for(i=0; i<tlEvents.length; i++)
    {
        tlEvents[i].domElement.setAttribute("eventIndex", i);
    }

}

function dateIntGregorian(dateString)
{
//    var tokens = dateString.split(" ");
    var tokens = dateString.match(/\S+/g);
    if(tokens[1] && tokens[1].toLowerCase() == "bc")
    {
        return tokens[0] * -1; //TODO this is temprary - it will cause an off by 1 error when calculating date differences
    }
    else
    {
        return tokens[0];
    }
}

function dateString(dateNumber)
{
    //if(currentScale > MEGA_ANNUM_THRESHOLD)
    if(Math.abs(Number(dateNumber)) > MEGA_ANNUM_THRESHOLD)
    {
        return dateMegaAnnum(dateNumber);
    }
    else
    {
        return dateGregorian(dateNumber);
    }
}

function dateGregorian(dateNumber)
{   
    var date = Number(dateNumber);
    var str;
    if(date <= 0)
    {
        str = Math.ceil(-date) + " BC"; //so -0.1, -1 becomes '1 BC'. NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
    }
    else if(date < 1000)
    {
        str = Math.ceil(date) + " AD"; //so 0.1, 0.5, 1 becomes '1 AD'. All dates in the range (0, 1] count as 1 AD
    }
    else
    {
        str = Math.ceil(date) + ""; //so 1000 becomes '1000'
    }

    return str;

}

function dateMegaAnnum(dateNumber)
{
    var date = Number(dateNumber);
   // var str = (date / MEGA_ANNUM).toFixed(2) + " Ma";
   var options = {
       maximumFractionDigits: 2
   }
   var str = (date/MEGA_ANNUM).toLocaleString("en-GB", options) + " Ma";

   return str;
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

    var scalefactor = 1.0/currentScale;
    //position all events correctly on the timeline
    for(var i=0; i<tlEvents.length; i++)
    {
        //1. determine offset from current year

        var offset = (tlEvents[i].date - currentYear) * scalefactor + 0.5;
        setPosition(tlEvents[i], offset);
        //console.log("offset: " + offset);
    }

    
    document.getElementById("currentYearLabel").innerHTML = dateString(currentYear); //refresh the year label
    //TODO other labels
}

function recentreTimeline()
{
    tlEvents.sort(compareTimelineEvents);
    var date0 = tlEvents[0].date;
    var date1 = tlEvents[tlEvents.length-1].date;
    console.log("Num events: " + tlEvents.length);
    console.log("Dates from " + date0 + " to " +  date1) ;

    var midpoint = (date0 + date1) /2;
    SetCurrentYear(midpoint);

    var newScale = (date1 - date0);
    SetCurrentScale(newScale);

    //refresh();
}



//handle mousewheel scaling
function myWheelHandler(event)
{   
    var y = event.deltaY;
    sliderScale = TimelineScaleToSliderScale(currentScale);
    sliderScale += y * MWHEEL_SCROLL_FACTOR;
    SetCurrentScale(SliderScaleToTimelineScale(sliderScale));

}

function SetCurrentScale(newScale)
{
    currentScale = newScale;
    //clamp scale
    currentScale = Math.min(currentScale, MAX_SCALE);
    currentScale = Math.max(currentScale, MIN_SCALE);
    refresh();

    console.log("New scale: " + currentScale);
}

function SetCurrentYear(newYear)
{
    currentYear = newYear;
   // document.getElementById("currentYearLabel").innerHTML = dateString(currentYear);
    refresh();
    console.log("Curent year: " +  currentYear);

    //TODO animation

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
var oldCurrentYear;

function timelineMouseDown(event)
{
    mouseDownY = event.pageY;
    oldCurrentYear=currentYear;
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
    console.log("Dragged " + draggedYearsAmount + " years");

    SetCurrentYear(oldCurrentYear - draggedYearsAmount);


  //  console.log("Curent year: " + currentYear);
  //  refresh();

}

function FinishDrag(){
    oldCurrentYear = currentYear;
    isDragging = false;
}


//TODO
// 'People alive' table - for current year, list living persons of significance + their ages
// 'current year' info window - link to wikipedia info

function onEventClick() //event handler for eventBubble DOM element
{
    console.log("Event clicked");
    //SetCurrentYear(this.getAttribute("startDate"));
    SelectEvent(this.getAttribute("eventIndex"));
    ZoomToDate(this.getAttribute("startDate"));
}

function SelectEvent(eventIndex)
{
    if(currentSelectedEvent != undefined)
    {
        var oldSelection = tlEvents[currentSelectedEvent];
        oldSelection.domElement.setAttribute("selected", false);
    }

    var newSelection = tlEvents[eventIndex];
    newSelection.domElement.setAttribute("selected", true);

    console.log("Selected " + newSelection.title);
    currentSelectedEvent = eventIndex;

}

// Handle timeline animation
var animTargetDate;
const ANIMATION_TIME = 500.0; //milliseconds
const ANIMATION_INTERVAL = 50.0; //milliseconds
const ANIMATION_NUMFRAMES = ANIMATION_TIME / ANIMATION_INTERVAL;
var progress;
var animID;

function ZoomToDate(date)
{
    animTargetDate = Number(date);
    animationTimeLeft = ANIMATION_TIME;	//reset anim clock
    animID = setInterval(AnimateMove, ANIMATION_INTERVAL);
    progress = 0.0;
}

function myLerp(x,y, a)
{
    return x*(1-a) + y*a;
}

function AnimateMove()
{
    progress += ANIMATION_INTERVAL/ANIMATION_TIME;
    if (progress < 1.0) {
        //lerp between old date and new date...
        var newYear = myLerp( oldCurrentYear, animTargetDate, progress);
        SetCurrentYear(newYear);
    }
    else
    {
        // end 

        SetCurrentYear(animTargetDate);
        oldCurrentYear = animTargetDate;
        clearInterval(animID);
    }
}