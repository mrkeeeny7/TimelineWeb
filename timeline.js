
//current timeline variables
var currentMin = -50; //min year
var currentMax = 50; //max year
var currentScale = 100;
var currentMinScale;    // scope of visible events
var currentMaxScale;    // scope of visible events
var currentYear = 0;    //TODO this is a placeholder for 1BC

//var tlEvents = [];
//var currentSelectedEvent;
var mainTimeline = undefined;
var secondTimeline = undefined;

var sliderScale;
const MIN_SCALE = 10;        //years
const MAX_SCALE = 1e10;      //years
var minZoom = Math.log(MIN_SCALE / 500.0);
var maxZoom = Math.log(MAX_SCALE / 500.0);

const TIMELINES_SELECTOR_FILE = "timelines/timeline_list.json";
const MEGA_ANNUM = 1000000; //1 million yrs = 1 Ma
const MEGA_ANNUM_THRESHOLD = 100000; //0.1 Ma

class Timeline {
    currentSelectedEventIndex = undefined;
    tlEvents = [];

    constructor(tableDom)
    {
        this.tableDom = tableDom; //TODO replace all references to getElementbyID("mainTable")
    }

    get currentSelectedEvent()
    {
        if(this.currentSelectedEventIndex != undefined && this.currentSelectedEventIndex >= 0)
        {
            return this.tlEvents[this.currentSelectedEventIndex];
        }
        else
        {
            return undefined;
        }
    }
    
    deselectEvent()
    {    
        if(this.currentSelectedEventIndex != undefined) //TODO placeholder for 'no selection'
        {
            this.currentSelectedEvent.domElement.setAttribute("selected", false);
            console.log("Deselected");
            this.currentSelectedEventIndex = -1;
        }

        UpdateInfoPanel();
    }

    //TODO use a GetSelectedEvent to clean this up

    selectEvent(eventIndex)
    {
        if(this.currentSelectedEvent != undefined) //TODO placeholder for 'no selection'
        {
            var oldSelection = this.currentSelectedEvent;
            oldSelection.domElement.setAttribute("selected", false);
        }


        this.currentSelectedEventIndex = eventIndex;
        var newSelection = this.currentSelectedEvent;
        newSelection.domElement.setAttribute("selected", true);

        console.log("Selected " + newSelection.title);

        //get info from wikipedia
        UpdateInfoPanel();

    }



    createEventBubbles(jsonObj)
    {
        //var eventsString = "";
        //eventsString += jsonObj.category + ": ";
    
        //clear exisiting stuff
        this.tlEvents = [];

        //document.getElementById("mainTable").innerHTML="";
    
        //remove existing eventBubbles
//        var bubbles = document.getElementsByClassName("eventBubble");
        var bubbles = this.tableDom.getElementsByClassName("eventBubble");
        for(let i=bubbles.length-1; i>=0; i--) //go from the end backwards to avoid weird iteration bugs
        {
            bubbles[i].remove();
        }
        
    
    
        for(let i=0; i<jsonObj.eventlist.length; i++)
        {
            var jsonEventObj = jsonObj.eventlist[i];        
            var eventDate, eventEndDate, eventBirthDate, eventDeathDate, eventType;
    
            eventDate = dateIntGregorian(jsonEventObj.dateString) ; //convert to numerical (so can sort, among other things)
            
            /*if(jsonEventObj.endDateString == undefined)
            {
                eventEndDate = eventDate;
            }
            else
            {
                eventEndDate = dateIntGregorian(jsonEventObj.endDateString);
            }  */      
            eventEndDate = dateIntIfDefined(jsonEventObj.endDateString, eventDate);
            eventBirthDate = dateIntIfDefined(jsonEventObj.birthDateString, eventDate);
            eventDeathDate = dateIntIfDefined(jsonEventObj.deathDateString, eventEndDate);
            
    
    
            if(jsonEventObj.type == undefined)
            {
                eventType = "basic";
            }
            else
            {
                eventType = jsonEventObj.type;
            }
    
    
    
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
            newEventDomElement.setAttribute("eventType", eventType);
           // newEventDomElement.appendChild(document.createTextNode(jsonEventObj.title    + "  " + dateString(eventDate)));
            newEventDomElement.appendChild(document.createTextNode(jsonEventObj.title));
    
            var lifelineDomElement = undefined;
            if(eventType=="person")
            {
                //add a lifeline
                lifelineDomElement = document.createElement("div");
                lifelineDomElement.setAttribute("class", " lifelineMarker");
                //lifelineDomElement.appendChild(newEventLifeline);
            
    
                //add to document
                this.tableDom.appendChild(lifelineDomElement);
                setVisibility(lifelineDomElement, false); //hide until mouse over evetn bubble
            }
    
            var newEvent = new TimelineEvent(
                jsonEventObj.title, eventDate, eventEndDate, eventBirthDate, eventDeathDate,
                jsonEventObj.searchstring, eventType, jsonEventObj.minScale, jsonEventObj.maxScale,
                newEventDomElement, lifelineDomElement);
            newEventDomElement.addEventListener("click", onEventClick);
            newEventDomElement.addEventListener("mouseover", onEventMouseOver);
            newEventDomElement.addEventListener("mouseout", onEventMouseOut);
            
            //save a reference
            this.tlEvents.push(newEvent);
    
            // add to the document
            this.tableDom.appendChild(newEventDomElement);
        }
        //document.getElementById("mainTable").innerHTML = eventsString;
        this.SortEventsList();
        this.recentreTimeline();
        this.refresh();
    
    }

    
    SortEventsList()
    {
        this.tlEvents.sort(compareTimelineEvents);
        //re-index the list
        for(let i=0; i<this.tlEvents.length; i++)
        {
            this.tlEvents[i].domElement.setAttribute("eventIndex", i);
        }

    }

    refresh() {
        currentMin = currentYear - currentScale/2;
        currentMax = currentYear + currentScale/2;
    
        var scalefactor = 1.0/currentScale;
        //position all events correctly on the timeline
        for(let i=0; i<this.tlEvents.length; i++)
        {
            let _tlevent = this.tlEvents[i];

            //1. determine visibility
            let withinVisibleScale=true;
            if(_tlevent.maxScale > 0 && currentScale > _tlevent.maxScale){
                withinVisibleScale = false;
            }
            if(_tlevent.minScale > 0 && currentScale < _tlevent.minScale){
                withinVisibleScale = false;
            }
        
            setVisibility(_tlevent.domElement, withinVisibleScale);
           // setVisibility(tlEvents[i].domElement, false);
    
    
            //2. determine offset from current year
    
            let offset = (_tlevent.date - currentYear) * scalefactor + 0.5;
            setPosition(_tlevent.domElement, offset);
            //console.log("offset: " + offset);
    
            //set lifline positions for persons
            if(_tlevent.type=="person")
            {
                offset = (_tlevent.birthDate - currentYear) * scalefactor + 0.5;
                setPosition(_tlevent.lifelineDomElement, offset);
    
                offset = (_tlevent.deathDate - currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.lifelineDomElement, offset);
            }
    
            if(_tlevent.type=="era")
            {
                //set bottom position by end date
                offset = (_tlevent.endDate - currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.domElement, offset);
            }
        }
    
        
        document.getElementById("currentYearLabel").innerHTML = dateString(currentYear); //refresh the year labels
        document.getElementById("minYearLabel").innerHTML = dateString(currentMin); 
        document.getElementById("maxYearLabel").innerHTML = dateString(currentMax); 
        //TODO other labels
    }
    
    recentreTimeline()
    {
        this.SortEventsList();
        var date0 = this.tlEvents[0].date;
        var date1 = this.tlEvents[this.tlEvents.length-1].date;
        console.log("Num events: " + this.tlEvents.length);
        console.log("Dates from " + date0 + " to " +  date1) ;
    
        var midpoint = (date0 + date1) /2;
        SetCurrentYear(midpoint);
    
        var newScale = (date1 - date0);
        SetCurrentScale(newScale);
    
        //refresh();
    }
}

class TimelineEvent {
    constructor(title, date, endDate, birthDate, deathDate, searchstring, type, minScale, maxScale,
         domElement, lifelineDomElement)
    {
        this.title = title;
        this.date = Number(date);
        this.endDate = Number(endDate);
        this.birthDate = Number(birthDate);
        this.deathDate = Number(deathDate);
        this.searchstring = searchstring;
        this.type = type;
        this.minScale = Number(minScale);
        this.maxScale = Number(maxScale);
        
        this.domElement = domElement; //html element
        this.lifelineDomElement = lifelineDomElement; //html element
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
    loadJSON(TIMELINES_SELECTOR_FILE, createAllSelectorOptions);
}

function createAllSelectorOptions(jsonObj)
{    
    var selectorDOM = document.getElementById("timelineSelect");
    var selectorDOM_second = document.getElementById("timelineSelect2");
    createSelectorOptions(jsonObj, selectorDOM);
    createSelectorOptions(jsonObj, selectorDOM_second);
}
    
function createSelectorOptions(jsonObj, selectorDOM)
{    

    //clear existing options
    selectorDOM.innerHTML="";
    for(let i=0; i<jsonObj.timelinelist.length; i++)
    {        
        var newSelectorOption = document.createElement("option");
        newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].filename);      //set the value as filename so we can use it when selecting
        //newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].title);
        newSelectorOption.appendChild(document.createTextNode(jsonObj.timelinelist[i].title));
        selectorDOM.appendChild(newSelectorOption);
    }

}

function timelineSelectorChanged(timelineIndex, value)
{    
    if(mainTimeline==undefined)
    {
        initTimelines();    //SHOULD initialize all timelines
    }

    var targetTimeline = mainTimeline;
    if(timelineIndex==1)
    {
        targetTimeline = secondTimeline;
    }

    loadTimeline(value, targetTimeline);
}

function initTimelines()
{
    mainTimeline = new Timeline(document.getElementById("mainTable"));
    secondTimeline = new Timeline(document.getElementById("secondTable"));
}

function loadTimeline(timelineFile, targetTimeline) //TODO add option to recentre/scale timeline
{

    //clear current selection
    targetTimeline.deselectEvent();

    console.log("Loading from " + timelineFile);
    loadJSON(timelineFile, loadBubbles, targetTimeline);

}

function loadBubbles(jsonObj, targetTimeline)
{
    targetTimeline.createEventBubbles(jsonObj);
}

function loadJSON(jsonfile, onFinishCallback, targetTimeline)
{
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() 
    {
        if (this.readyState == 4) {     //response ready
            if( this.status == 200)     //"OK"
            {
                var jsonObj = JSON.parse(this.responseText);    //TODO try adding the reviver function here
                onFinishCallback(jsonObj, targetTimeline);
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

/**
 * 
 * Convert input string to a Gregorian date number
 * 
 * @param {string} dateString the input string to try
 * @param {number} backup the date to use if input is undefined
 */
function dateIntIfDefined(dateString, backup)
{
    if(dateString == undefined)
    {
        return backup;
    }
    else
    {
        return dateIntGregorian(dateString);
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

/*
function appendData(data) {
    var mainContainer = document.getElementById("mainTable");
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = 'Name: ' + data[i].firstName + ' ' + data[i].lastName;
        mainContainer.appendChild(div);
    }
}*/

/**
 * 
 * @param {DOM element} domElement the timeline event to move
 * @param {number} heightFactor the y-position to set as a fraction of the overall range, in the range [0,1]
 */
function setPosition(domElement, heightFactor)

{
    domElement.style.top = (heightFactor*100) + "%";
    //CSS will adjust veritcal offset to centre the bubble
}

/**
 * 
 * @param {DOM element} tlEvent the timeline event to move
 * @param {number} heightFactor the y-position to set as a fraction of the overall range, in the range [0,1]
 * 
 * Used for era bubbles that stretch multiple years
 */
function setBottomPosition(domElement, heightFactor)
{
    domElement.style.bottom = ((1-heightFactor)*100) + "%";
}

function setVisibility(domElement, isVisible)
{    
    if(isVisible)
    {
        domElement.style.display =  "block";
    }
    else
    {
      //  console.log("hiding: " + tlEvent.title);
        domElement.style.display =  "none";
    }
}

function UpdateInfoPanel()
{
    document.getElementById("infoPanel").innerHTML = "";
    if(mainTimeline.currentSelectedEvent != undefined)
    {
        var tlEvent = mainTimeline.currentSelectedEvent;
        //create content for info panel
        var newDiv = document.createElement("div");
        //newDiv.setAttribute("class", "eventBubble");

        var titleDOM = document.createElement("h2");
        titleDOM.innerText = tlEvent.title;

        var dateDOM = document.createElement("p");
        if(tlEvent.endDate != tlEvent.date)
        {
            dateDOM.innerText = dateString(tlEvent.date) + " - " + dateString(tlEvent.endDate);
        }
        else
        {
            dateDOM.innerText = dateString(tlEvent.date);
        }

        newDiv.appendChild(titleDOM);
        newDiv.appendChild(dateDOM);
        document.getElementById("infoPanel").appendChild(newDiv);
    }


    //TODO just add a link to wikpedia page? e.g. wikiURL: https://en.wikipedia.org/page_name

}

function UpdateInfoPanelWikpedia()
{
    var requestString = mainTimeline.currentSelectedEvent.searchstring;
    var url = "https://en.wikipedia.org/w/api.php?";
    var xmlhttp = new XMLHttpRequest();
    
    xmlhttp.onreadystatechange = function() 
    {
        if (this.readyState == 4) {     //response ready
            if( this.status == 200)     //"OK"
            {
                var result = this.responseText;    //TODO try adding the reviver function here
                requestWikipediaContent(result);
            }
            else if(this.status == 404)
            {
                console.log("Page not found: " + url);
                //TODO put another callback to display on the page
                //TODO add a waiting icon to show timeline is loading
            }
            else
            {
                console.log("Error loading page " + url + ": " + this.statusText);
            }
        }
    };

    
	/*		form.AddField ("title", page_title);
			form.AddField ("action", "parse");
			form.AddField ("prop", "wikitext");
			//form.AddField ("section", 0);
            form.AddField ("format", "json");
      */      
    xmlhttp.open("GET", url, true); //currently using POST to avoid caching; TODO look into best options for this
  //  xmlhttp.send("title="+requestString+"&origin='https://www.mediawiki.org'&action=parse&prop=wikitext&section=0&format=json");
    xmlhttp.send("title="+requestString+"&origin='https://www.mediawiki.org'&action=query&format=jsonp");
}

function requestWikipediaContent(searchResult)
{
    console.log(searchResult);

}

function setInfoPanel(content)
{
    document.getElementById("infoPanel").innerHTML = content;
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
    mainTimeline.refresh();

  //  console.log("New scale: " + currentScale);
}

function SetCurrentYear(newYear)
{
    currentYear = newYear;
   // document.getElementById("currentYearLabel").innerHTML = dateString(currentYear);
    mainTimeline.refresh();
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
    mainTimeline.selectEvent(this.getAttribute("eventIndex"));
    ZoomToDate(this.getAttribute("startDate"));
}


function onEventMouseOver()
{
    var tlEvent = mainTimeline.tlEvents[this.getAttribute("eventIndex")];
    console.log("mouse over " + tlEvent.title);

    if(tlEvent.type=="person")
    {
        setVisibility(tlEvent.lifelineDomElement, true);
    }
}

function onEventMouseOut()
{
    var tlEvent = mainTimeline.tlEvents[this.getAttribute("eventIndex")];
    if(tlEvent.type=="person")
    {
        setVisibility(tlEvent.lifelineDomElement, false);
    }
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