

//var tlEvents = [];
//var currentSelectedEvent;
var mainTimeline = undefined;
var secondTimeline = undefined;
var all_timelines = [];
//this will point to one of the above timelines, if defined
/**
 * @type { Timeline }
 */
var selectedTimeline = undefined;

var timelinesLocked=false;

const MIN_SCALE = 10;        //years
const MAX_SCALE = 1e10;      //years
var minZoom = Math.log(MIN_SCALE / 500.0);
var maxZoom = Math.log(MAX_SCALE / 500.0);

const TIMELINES_SELECTOR_FILE = "timelines/timeline_list.json";
const MEGA_ANNUM = 1000000; //1 million yrs = 1 Ma
const MEGA_ANNUM_THRESHOLD = 100000; //0.1 Ma

//magic numbers
const MWHEEL_SCROLL_FACTOR = 0.01;

const ANIMATION_TIME = 500.0; //milliseconds
const ANIMATION_INTERVAL = 50.0; //milliseconds
const ANIMATION_NUMFRAMES = ANIMATION_TIME / ANIMATION_INTERVAL;

class PersonData
{
    /**
     * @type {string}
     */
    name;
    /**
    * @type {string}
    */
    birthDateString;
    /**
    * @type {string}
    */
    deathDateString;

    /**
    * @type {number}
    */
    birthYear;
    /**
    * @type {number}
    */
    deathYear;

    /**
     * @constructor
     * @param {{name: string, birthDateString: string, deathDateString: string} personDataJSObj}
     */
    constructor(personDataJSObj)
    {
        this.name               = personDataJSObj.name;
        this.birthDateString    = personDataJSObj.birthDateString;
        this.deathDateString    = personDataJSObj.deathDateString;

        this.birthYear = dateIntGregorian(this.birthDateString);
        this.deathYear = dateIntGregorian(this.deathDateString);
    }

    /**
     * 
     * @param {number} year 
     * @returns {number} age of this person in a given year
     */
    ageAtYear(year)
    {
        return year - this.birthYear;
    }

    /**
     * 
     * @param {number} year 
     * @returns {boolean} alive status of this person in a given year
     */
    aliveInYear(year)
    {
        return year >= this.birthYear && year <= this.deathYear;
    }

}

class PersonListSorted {

    /**
     * @type {PersonData[]}
     */
    theList = []; //for now, just use an array and sort() when inserting. TODO implement better if necessary

    /**
     * 
     * @param {Object} jsonPersonObj 
     */
    Insert(jsonPersonObj)
    {
        var newPerson = new PersonData(jsonPersonObj);

        if(this.theList.length == 0)
        {
            this.theList.push(newPerson);
        }
        else
        {
            this.theList.push(newPerson);

            //TODO only sort if new person is in the wrong order
            //TODO or could just insert at the correct position by iterating
            this.theList.sort(function(a,b) { return a.birthYear - b.birthYear; })
        }
    }

    /**
     * 
     * @param {number} year
     * @returns {PersonData[]}  list of persons alive in the given year
     */
    PersonsAliveList(year)
    {
        var alivelist = new Array();
        for(let i = 0; i<this.theList.length; i++)
        {
            if(this.theList[i].aliveInYear(year))
            {
                alivelist.push(this.theList[i]);
            }
        }

        return alivelist;
    }

    /**
     * 
     * @param {number} year 
     * @returns {string} (HTML formatted) A summary string of the persons alive in given year
     */
    PersonsAliveStringHTML(year)
    {
        var alivelist = this.PersonsAliveList(year);
        var outstr = "<h3>Notable People</h3>";
        for(let i=0; i<alivelist.length; i++)
        {
            var age = Math.floor(alivelist[i].ageAtYear(year));
            var textline = age + " years: " + alivelist[i].name;

            //italic if in death year
            if(Math.abs(alivelist[i].deathYear - year) < 1)
            {
                textline = "<i>" + textline + " (year of death)" + "</i>";
            }

            //add to outstr
            if(outstr == "")
            {
                outstr = textline;
            }
            else
            {
                outstr = outstr + "<br>" + textline;
            }
        }

        return outstr;
    }    
    
    /**
    * 
    * @param {number} year 
    * @returns {string} A summary string of the persons alive in given year
    */
   PersonsAliveString(year)
   {
       var alivelist = this.PersonsAliveList(year);
       var outstr = "";
       for(let i=0; i<alivelist.length; i++)
       {
           var age = alivelist[i].ageAtYear(year);
           var textline = age + " years: " + alivelist[i].name;

           //add to outstr
           if(outstr == "")
           {
               outstr = textline;
           }
           else
           {
               outstr = outstr + "\n" + textline;
           }
       }

       return outstr;
   }

}

class Timeline {
    currentSelectedEventIndex = undefined;
    tlEvents = [];

    /**
     * @type {PersonListSorted}
     */
    personlist = new PersonListSorted();

    //current timeline variables
    currentMin = -50; //min year
    currentMax = 50; //max year
    currentScale = 100;
    currentMinScale;    // scope of visible events
    currentMaxScale;    // scope of visible events
    currentYear = 0;    //TODO this is a placeholder for 1BC
    oldCurrentYear;
    
    sliderScale;
    inverted=false;
    numColumns=3;
    availableColumns=[2,1,0];

    //the offset from the main timeline, if timelines are locked
    lockOffset=0;
    lockScaleOffset=0;

    constructor(tableDom, timelineIndex)
    {
        this.tableDom = tableDom; //TODO replace all references to getElementbyID("mainTable")
        this.timelineIndex = timelineIndex;

        this.currentYearLabelDom = document.getElementById("currentYearLabel" + timelineIndex);
        this.minYearLabelDom = document.getElementById("minYearLabel" + timelineIndex);
        this.maxYearLabelDom = document.getElementById("maxYearLabel" + timelineIndex);

        all_timelines.push(this);
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
    
    clearEventSelection()
    {    
        if(this.currentSelectedEvent != undefined) //TODO placeholder for 'no selection'
        {
            this.currentSelectedEvent.setSelectedStatus(false);
            console.log("Deselected");
            this.currentSelectedEventIndex = -1;
        }

        UpdateInfoPanel(); //TODO clear info panel here
    }

    //TODO use a GetSelectedEvent to clean this up

    selectEvent(eventIndex)
    {
        //first, select current timeline
        this.selectTable();


        if(this.currentSelectedEvent != undefined) //TODO placeholder for 'no selection'
        {
            var oldSelection = this.currentSelectedEvent;
            oldSelection.setSelectedStatus(false);
        }


        this.currentSelectedEventIndex = eventIndex;
        var newSelection = this.currentSelectedEvent;

        newSelection.setSelectedStatus(true);

        console.log("Selected " + newSelection.title);



        //get info from wikipedia
        UpdateInfoPanel();

    }

    selectTable()
    {
        //clear previous selection
        if(selectedTimeline!=undefined && selectedTimeline!=this)
        {
            clearSelectedTimeline();
        }

        selectedTimeline = this;
        this.tableDom.setAttribute("selected", true);
    }

    deselectTable(){

        //clear current event selection
        this.clearEventSelection();

        // deselect the timeline
        selectedTimeline = undefined;
        this.tableDom.setAttribute("selected", false);
    }

    /**
     * 
     * de facto, this loads data fronm the json obj
     * TODO load Person data from person list into a local list of persons
     * 
     * @param {Object} jsonObj the JSON data for this timeline
     * @param {boolean} clearExistingFlag whether to clear existing data before loading new data
     */
    createEventBubbles(jsonObj, clearExistingFlag)
    {
        //var eventsString = "";
        //eventsString += jsonObj.category + ": ";
    
        if(clearExistingFlag)
        {
            //clear existing stuff
            this.tlEvents = [];
      
        
            //remove existing eventBubbles
            var bubbles = this.tableDom.getElementsByClassName("eventBubble");
            for(let i=bubbles.length-1; i>=0; i--) //go from the end backwards to avoid weird iteration bugs
            {
                bubbles[i].remove();
            }
        
         }

         // find an available column for this list
        var currentColumn=0;

        if(this.availableColumns.length > 0)
        {
            currentColumn = this.availableColumns.pop();
        }
        else
        {
            //need to free up a column or something
            // check overlaps
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
            eventBirthDate = dateIntIfDefined(jsonEventObj.birthDateString, undefined); //set birth and death to undefined if not known
            eventDeathDate = dateIntIfDefined(jsonEventObj.deathDateString, undefined);
            
    
    
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

            var newEventText=document.createTextNode(jsonEventObj.title);
            newEventDomElement.appendChild(newEventText);
    
            var lifelineDomElement = undefined;
            if(eventType=="person")
            {
                //add a lifeline
                lifelineDomElement = document.createElement("div");
                lifelineDomElement.setAttribute("class", " lifelineBracket");
                //lifelineDomElement.appendChild(newEventLifeline);
            
    
                //add to document
                this.tableDom.appendChild(lifelineDomElement);
                setVisibility(lifelineDomElement, false); //hide until mouse over evetn bubble
            }
    
            var newEvent = new TimelineEvent(
                jsonEventObj.title, eventDate, eventEndDate, eventBirthDate, eventDeathDate,
                jsonEventObj.searchstring, eventType, jsonEventObj.minScale, jsonEventObj.maxScale,
                newEventDomElement, lifelineDomElement, currentColumn);
                
            let tlIndex = this.timelineIndex;
            newEventDomElement.addEventListener("click", function() { onEventClick(tlIndex, this.getAttribute("eventIndex"), this.getAttribute("startDate")); });
            newEventDomElement.addEventListener("mouseover", function() { onEventMouseOver(tlIndex, this.getAttribute("eventIndex")); });
            newEventDomElement.addEventListener("mouseout", function() { onEventMouseOut(tlIndex, this.getAttribute("eventIndex")); });
            
            //save a reference
            this.tlEvents.push(newEvent);
    
            // add to the document
            this.tableDom.appendChild(newEventDomElement);
        }
        //document.getElementById("mainTable").innerHTML = eventsString;
        this.SortEventsList();
        this.recentreTimeline();

        // load person list
        for(let i=0; i<jsonObj.personlist.length; i++)
        {
            //var newPerson = new PersonData(jsonObj.personlist[i])
            this.personlist.Insert(jsonObj.personlist[i]);
        }


        if(jsonObj.defaultDateString != undefined)
        {
            var defaultDate = dateIntGregorian(jsonObj.defaultDateString);
            this.setCurrentYear(defaultDate);
        }

        if(jsonObj.defaultScale != undefined)
        {
            this.setCurrentScale(jsonObj.defaultScale);
        }

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
        this.currentMin = this.currentYear - this.currentScale/2;
        this.currentMax = this.currentYear + this.currentScale/2;
    
        var scalefactor = 1.0/this.currentScale;
        //position all events correctly on the timeline
        for(let i=0; i<this.tlEvents.length; i++)
        {
            let _tlevent = this.tlEvents[i];

            //1. determine visibility
            let withinVisibleScale=true;
            if(_tlevent.maxScale > 0 && this.currentScale > _tlevent.maxScale){
                withinVisibleScale = false;
            }
            if(_tlevent.minScale > 0 && this.currentScale < _tlevent.minScale){
                withinVisibleScale = false;
            }
        
            setVisibility(_tlevent.domElement, withinVisibleScale);
           // setVisibility(tlEvents[i].domElement, false);
    
    
            //2. determine offset from current year
    
            let offset = (_tlevent.date - this.currentYear) * scalefactor + 0.5;
            setPosition(_tlevent.domElement, offset);
            //console.log("offset: " + offset);
    
            //set lifline positions for persons
            if(_tlevent.type=="person")
            {
                //use birth and death dates if available
                var lifelineStart = (_tlevent.birthDate==undefined)? _tlevent.date : _tlevent.birthDate;
                var lifelineEnd = (_tlevent.deathDate==undefined)? _tlevent.date : _tlevent.deathDate;

                offset = (lifelineStart - this.currentYear) * scalefactor + 0.5;
                setPosition(_tlevent.lifelineDomElement, offset);
    
                offset = (lifelineEnd - this.currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.lifelineDomElement, offset);

                //TODO move lifeline to correct column
            }
    
            if(_tlevent.type=="era")
            {
                //set bottom position by end date
                offset = (_tlevent.endDate - this.currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.domElement, offset);

            }
            //position in preferred column
            this.setColumn(_tlevent, _tlevent.preferredColumn);
        }
    
        
        this.currentYearLabelDom.innerHTML = dateString(this.currentYear); //refresh the year labels
        this.minYearLabelDom.innerHTML = dateString(this.currentMin); 
        this.maxYearLabelDom.innerHTML = dateString(this.currentMax); 
        //TODO other labels
    }

    setColumn(_tlevent, columnNumber)
    {
        if(columnNumber > this.numColumns-1)
        {
            this.setColumn(_tlevent, 0);
        }
        else
        {
            var width = (100.0 / this.numColumns); // as a %

            const columnspacing = 0.1; //10% of table width
            //derived
            const widthfactor = 1-columnspacing;

            var leftoffset = 0.4;
            if(_tlevent.type=="era")
            {
                leftoffset = columnspacing*0.5; //to center the events; use 0 to left align
            //   setWidth(_tlevent.domElement, width);
                _tlevent.domElement.style.width = (width * widthfactor) + "%"; //use 90% for a bit of spacing

            }
            else if(_tlevent.type=="person")
            {
                leftoffset = 1.2; //to center the events; use 0 to left align

                // set lifeline column
                _tlevent.lifelineDomElement.style.left = ((columnNumber + leftoffset)*width) + "%";
            }
            _tlevent.domElement.style.left = ((columnNumber + leftoffset)*width) + "%";

            console.log("Set column width to " + width);
        }
    }
    
    recentreTimeline()
    {
        this.SortEventsList();
        var date0 = this.tlEvents[0].date;
        var date1 = this.tlEvents[this.tlEvents.length-1].date;
        console.log("Num events: " + this.tlEvents.length);
        console.log("Dates from " + date0 + " to " +  date1) ;
    
        var midpoint = (date0 + date1) /2;
        this.setCurrentYear(midpoint);
    
        var newScale = (date1 - date0);
        this.setCurrentScale(newScale);
    
        //refresh();
    }

    
    setCurrentScale(newScale, propagate=true)
    {
        console.log("Setting scale " + newScale);
        this.currentScale = newScale;
        //clamp scale
        this.currentScale = Math.min(this.currentScale, MAX_SCALE);
        this.currentScale = Math.max(this.currentScale, MIN_SCALE);
        this.refresh();

    //  console.log("New scale: " + currentScale);

        //update all the other timelines
        if(timelinesLocked && propagate)
        {
            for(let i=0; i<all_timelines.length; i++)
            {
                var offset = all_timelines[i].lockScaleOffset - this.lockScaleOffset;
                if(all_timelines[i]!=this)
                {
                   // all_timelines[i].setCurrentScale(mainTimeline.currentScale + offset, false);
                    all_timelines[i].setCurrentScale(this.currentScale, false);     //just set the scales equal
                    all_timelines[i].refresh();
                }
            }
        }
        
    }

    setCurrentYear(newYear, propagate=true)
    {
        this.currentYear = newYear;
    // document.getElementById("currentYearLabel").innerHTML = dateString(currentYear);
        this.refresh();
        console.log("TL" + this.timelineIndex + " Curent year: " +  this.currentYear);


        //update all the other timelines
        if(timelinesLocked && propagate)
        {
            for(let i=0; i<all_timelines.length; i++)
            {
                var offset = all_timelines[i].lockOffset - this.lockOffset;
                if(all_timelines[i]!=this) //shouldnt be needed
                {
                    //all_timelines[i].setCurrentYear(mainTimeline.currentYear + offset, false);
                    if(all_timelines[i].inverted)
                    {
                        all_timelines[i].setCurrentYear(-this.currentYear, false);
                    }
                    else
                    {
                        all_timelines[i].setCurrentYear(this.currentYear, false);
                    }
                    all_timelines[i].refresh();
                }
            }
        }

        //update the HTML field
        updateYearInput();
        //update the HTML in the person panel
        //TODO maybe need a callback/event handler
        UpdatePersonPanel();
    } 


}  


// Handle timeline animation
var animTargetDate;
var animProgress;
var animID;
var animTimeline;

function AnimateMove()
{
    animProgress += ANIMATION_INTERVAL/ANIMATION_TIME;
    if (animProgress < 1.0) {
        //lerp between old date and new date...
        var newYear = myLerp( animTimeline.oldCurrentYear, animTargetDate, animProgress);
        animTimeline.setCurrentYear(newYear);
    }
    else
    {
        // end 

        animTimeline.setCurrentYear(animTargetDate);
        animTimeline.oldCurrentYear = animTargetDate;
        clearInterval(animID);
    }
}

function ZoomToDate(date, timelineIndex)
{
    var targetTimeline = getTimeline(timelineIndex);
    animTimeline = targetTimeline;
    animTargetDate = Number(date);
    animProgress = 0.0;
    animID = setInterval(AnimateMove, ANIMATION_INTERVAL);
}




class TimelineEvent {
    constructor(title, date, endDate, birthDate, deathDate, searchstring, type, minScale, maxScale,
         domElement, lifelineDomElement, preferredColumn=0)
    {
        this.title = title;
        this.date = Number(date);
        this.endDate = Number(endDate);
        this.birthDate = birthDate;
        this.deathDate = deathDate;
        this.searchstring = searchstring;
        this.type = type;
        this.minScale = Number(minScale);
        this.maxScale = Number(maxScale);
        
        this.domElement = domElement; //html element
        this.lifelineDomElement = lifelineDomElement; //html element

        //other fields
        this.selected=false;
        this.preferredColumn=preferredColumn;
    }

    setSelectedStatus(value)
    {        
        this.selected=value;
        this.domElement.setAttribute("selected", value);
        this.setLifelineVisible(value);
    }

    setLifelineVisible(value)
    {
        if(this.type=="person")
        {            
            setVisibility(this.lifelineDomElement, value);
        }
    }
}
function compareTimelineEvents(a,b)
{
    return a.date - b.date;
}


function getTimeline(timelineIndex)
{
    if(timelineIndex==1)
    {
        return secondTimeline;
    }
    else
    {
        return mainTimeline;
    }
}

// Test function
function myfunc()
{
    document.getElementById("mainTable")
    .innerHTML = "Testing";
}

function toggleTimelineLock(button)
{
    timelinesLocked = !timelinesLocked;
    button.setAttribute("toggledStatus", timelinesLocked);
    button.innerText=timelinesLocked?"Unlock Timelines":"Lock Timelines";

    if(timelinesLocked)
    {
        secondTimeline.lockOffset = secondTimeline.currentYear - mainTimeline.currentYear;
        secondTimeline.lockScaleOffset = secondTimeline.currentScale - mainTimeline.currentScale;
    }

    document.getElementById("lockStatusLabel").innerText =
     "Lock offset for second timeline: " + secondTimeline.lockOffset + ", Scale offset: " + secondTimeline.lockScaleOffset;
}

function toggleSecondTimelineInvert(button)
{
    secondTimeline.inverted = !secondTimeline.inverted;
    button.setAttribute("toggledStatus", secondTimeline.inverted);
 //   button.innerText=timelinesLocked?"Unlock Timelines":"Lock Timelines";
}

function clearSelectedTimeline()
{    
    if(selectedTimeline!=undefined)
    {
        selectedTimeline.deselectTable();
    }
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

// update the value of the HTML year field
function updateYearInput()
{
    var yearInputDOM = document.getElementById("yearInput");
  //  yearInputDOM.value = dateString(mainTimeline.currentYear);
    yearInputDOM.value = dateGregorian(mainTimeline.currentYear);
}

//update the current year FROM the HTML field
function submitYearInput()
{
    var yearInputDOM = document.getElementById("yearInput");
    mainTimeline.setCurrentYear(dateIntGregorian(yearInputDOM.value));
}

function initTimelines()
{
    mainTimeline = new Timeline(document.getElementById("mainTable"), 0);
    secondTimeline = new Timeline(document.getElementById("secondTable"), 1);

    secondTimeline.inverted=false;
}

/**
 * 
 * Load this data into the Timeline obj and create the event bubbles
 * 
 * @param {string} timelineFile the JSON file to read the data from
 * @param {Timeline} targetTimeline the Timeline to load the data into
 */
function loadTimeline(timelineFile, targetTimeline) //TODO add option to recentre/scale timeline
{

    //clear current selection
    targetTimeline.clearEventSelection();

    console.log("Loading from " + timelineFile);
    loadJSON(timelineFile, loadBubbles, targetTimeline);

}

/**
 * 
 * Load this data into the Timeline obj and create the event bubbles
 * 
 * @param {Object} jsonObj the JSON data
 * @param {Timeline} targetTimeline the Timeline to load the data into
 */
function loadBubbles(jsonObj, targetTimeline)
{
    targetTimeline.createEventBubbles(jsonObj, false);
}

/**
 * 
 * Load data into the Timeline obj and create the event bubbles
 * 
 * @param {string} jsonfile the JSON file to read the data from
 * @param {Function} onFinishCallback the function to call when the file has been fetched
 * @param {Timeline} targetTimeline the Timeline to load the data into
 */
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
    xmlhttp.open("GET", jsonfile, true);
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

/**
 * 
 * create date int from string in format "[year]" or "[year] BC"
 * 
 * @param {string} dateString the input string 
 */
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

/**
 * 
 * create date string from number
 * use this for most purposes
 * 
 * @param {number} dateNumber the input string 
 */
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
/**
 * 
 * create Gregorian date string from number
 * 
 * @param {number} dateNumber the input string 
 */
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

/**
 * 
 * create MA date string from number
 * 
 * @param {number} dateNumber the input string 
 */
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
 * @param {Element} domElement
 * @param {number} heightFactor the y-position to set as a fraction of the overall range, in the range [0,1]
 */
function setPosition(domElement, heightFactor)

{
    domElement.style.top = (heightFactor*100) + "%";
    //CSS will adjust veritcal offset to centre the bubble
}

/**
 * 
 * @param {Element} domElement 
 * @param {number} heightFactor the y-position to set as a fraction of the overall range, in the range [0,1]
 * 
 * Used for era bubbles that stretch multiple years
 */
function setBottomPosition(domElement, heightFactor)
{
    domElement.style.bottom = ((1-heightFactor)*100) + "%";
}

/**
 * 
 * @param {Element} domElement
 * @param {number} width
 * 
 */
function setWidth(domElement, width)//TODO remove if redundant
{
    domElement.style.width = width;
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

/**
 * Clears and updates the inner HTML of the Info Panel
 */
function UpdateInfoPanel()
{
    var infoPanel = document.getElementById("infoPanel");
    infoPanel.innerHTML = ""; //clears the info Panel

    if(selectedTimeline!=undefined && selectedTimeline.currentSelectedEvent != undefined)
    {
        var tlEvent = selectedTimeline.currentSelectedEvent;
        //create content for info panel
        var newDiv = document.createElement("div");
        //newDiv.setAttribute("class", "eventBubble");

        var titleDOM = document.createElement("h2");
      //  titleDOM.innerText = tlEvent.title;

        var dateText = "";
        if(tlEvent.endDate != tlEvent.date)
        {
            dateText = dateString(tlEvent.date) + " - " + dateString(tlEvent.endDate);
        }
        else
        {
            dateText = dateString(tlEvent.date);
        }
     //   addParagraph(newDiv, dateText);
        titleDOM.innerText = tlEvent.title + " (" + dateText + ")";
        newDiv.appendChild(titleDOM);

        if(tlEvent.type=="person")
        {
            var lifetimetext = "Lived: " + ( (tlEvent.birthDate==undefined)? "unknown date" : dateString(tlEvent.birthDate) ) 
            + " to " + ((tlEvent.deathDate==undefined)? "unknown date" : dateString(tlEvent.deathDate));

            if(tlEvent.birthDate!=undefined && tlEvent.deathDate!=undefined)
            {
                lifetimetext = lifetimetext + " (" + (tlEvent.deathDate-tlEvent.birthDate) + " years)"
            }

            addParagraph(newDiv, lifetimetext);
        }

        infoPanel.appendChild(newDiv);
    }

   


    //TODO just add a link to wikpedia page? e.g. wikiURL: https://en.wikipedia.org/page_name

}

/**
 * Clears and updates the inner HTML of the Person Panel
 */
function UpdatePersonPanel()
{
    var personPanel = document.getElementById("personPanel");
    personPanel.innerHTML = ""; //clears the  Panel 
    
    // add the persons alive list
    // TODO infoPanel gets cleared every click update
    //  so create a separate section that will update when currentYear changes
    if(selectedTimeline!=undefined)
    {
        //create content for info panel
       // var newDiv = document.createElement("div");
       // var titleDOM = document.createElement("h2");

       //var aliveListText = selectedTimeline.personlist.PersonsAliveString(selectedTimeline.currentYear);
       var aliveListHTML = selectedTimeline.personlist.PersonsAliveStringHTML(selectedTimeline.currentYear);
        //newDiv.innerText = aliveListText;

        //document.getElementById("personPanel").appendChild(newDiv);
        //personPanel.innerText = aliveListText;
        personPanel.innerHTML = aliveListHTML;
    }

}

function addParagraph(parent, text)
{
    var newPara = document.createElement("p");
    newPara.innerText = text;
    parent.appendChild(newPara);

    return newPara;
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
                UpdateInfoPanel();
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
    document.getElementById("infoPanel").innerHTML = searchResult;

}

function setInfoPanel(content)
{
    document.getElementById("infoPanel").innerHTML = content;
}



function isTimelineInitialized(timelineIndex)
{
    return getTimeline(timelineIndex)!=undefined;
}


//handle mousewheel scaling
function myWheelHandler(event, timelineIndex)
{     
    if(!isTimelineInitialized(timelineIndex))
    {
        console.log("Timeline not initialized");
        return;
    } 
    var targetTimeline = getTimeline(timelineIndex);




    if(event.deltaY==0)
    {
        console.log("No wheel delta");
        return;
    }
    var y = event.deltaY / Math.abs(event.deltaY);  //value should be 1 or -1
    targetTimeline.sliderScale = TimelineScaleToSliderScale(targetTimeline.currentScale);
    targetTimeline.sliderScale += y * MWHEEL_SCROLL_FACTOR;
    targetTimeline.setCurrentScale(SliderScaleToTimelineScale(targetTimeline.sliderScale));

    
   // console.log("scaling timeline " + timelineIndex + " deltaY=" + y);

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
function timelineMouseDown(event, timelineIndex)
{    
    if(!isTimelineInitialized(timelineIndex))
    {
        console.log("Timeline not initialized");
        return;
    }

    var targetTimeline = getTimeline(timelineIndex);
    mouseDownY = event.pageY;
    targetTimeline.oldCurrentYear=targetTimeline.currentYear;
    isDragging = true;
}

function timelineMouseMove(event, timelineIndex)
{   
    if(!isTimelineInitialized(timelineIndex))
    {
        console.log("Timeline not initialized");
        return;
    }

    if(isDragging)
    {        
		var dragAmount = (event.pageY - mouseDownY);
		DragTimeline (dragAmount, timelineIndex);
    }
}

function timelineMouseUp(timelineIndex)
{   
    if(!isTimelineInitialized(timelineIndex))
    {
        console.log("Timeline not initialized");
        return;
    }
    FinishDrag(timelineIndex);
}

function DragTimeline(dragAmount, timelineIndex)
{
    var targetTimeline = getTimeline(timelineIndex);
    var dragScale = targetTimeline.currentScale / 500.0; //scale the dragging speed with the timeline scale

    var draggedYearsAmount = dragScale * dragAmount;
    console.log("Dragged " + draggedYearsAmount + " years");

    targetTimeline.setCurrentYear(targetTimeline.oldCurrentYear - draggedYearsAmount);


  //  console.log("Curent year: " + currentYear);
  //  refresh();

}

function FinishDrag(timelineIndex)
{
    var targetTimeline = getTimeline(timelineIndex);

    targetTimeline.oldCurrentYear = targetTimeline.currentYear;
    isDragging = false;
}


//TODO
// 'People alive' table - for current year, list living persons of significance + their ages
// 'current year' info window - link to wikipedia info

function onEventClick(timelineIndex, eventIndex, startDate) //event handler for eventBubble DOM element
{
    console.log("Event clicked, timeline " + timelineIndex);
    var targetTimeline = getTimeline(timelineIndex);

    //SetCurrentYear(this.getAttribute("startDate"));
    targetTimeline.selectEvent(eventIndex);
    ZoomToDate(startDate, timelineIndex);
}


function onEventMouseOver(timelineIndex, eventIndex)
{
    var tlEvent = getTimeline(timelineIndex).tlEvents[eventIndex];
    console.log("mouse over " + tlEvent.title + " timeline " + timelineIndex);

    tlEvent.setLifelineVisible(true); //will do nothing unless type is 'person'
}

function onEventMouseOut(timelineIndex, eventIndex)
{
    var tlEvent = getTimeline(timelineIndex).tlEvents[eventIndex];
    if(!tlEvent.selected)
    {
        tlEvent.setLifelineVisible(false);
    }
}

function tableClicked(timelineIndex)
{
    var target = getTimeline(timelineIndex);

    if(target!=undefined)
    {
        //target.clearEventSelection();
        target.selectTable();
    }
}

function myLerp(x,y, a)
{
    return x*(1-a) + y*a;
}


/**
 * Bugtracker
 * 
 * 1. Lifelines should disappear when the event bubble disappears (out of scale range)
 * 
 * 2. Lifelines should only appear when big enough to be meaningful
 * 
 * 3. Add num columns to table definition; timeline events can then be assigned a column number. Optional: reserve an 'empty' column on the right for persons
 * 
 */