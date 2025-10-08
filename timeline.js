

//var tlEvents = [];
//var currentSelectedEvent;

//timeline files
//var jsonFileQueue = [];

/** @type {Timeline} */
var mainTimeline = undefined;
/** @type {Timeline} */
var secondTimeline = undefined;
/** @type {Timeline[]} */
var all_timelines = [];

//this will point to one of the above timelines, if defined
/** @type { Timeline } */
var selectedTimeline = undefined;

/** @type {boolean} */
var timelinesLocked=false;

//HTML DOM elements
/** @type {HTMLElement[]} */
var colHeaderDOMLeft;
/** @type {HTMLElement[]} */
var colHeaderDOMRight;

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
     * @type {boolean}
     */
    ageIsAppox;

    /**
     * @type {number[]}
     * array of dates corresponding to the time this person was a 'ruler', if any
     */
    ruled;

    /**
     * @constructor
     * @param {{name: string, birthDateString: string, deathDateString: string} personDataJSObj}
     */
    constructor(personDataJSObj)
    {
        this.name               = personDataJSObj.name;
        this.birthDateString    = personDataJSObj.birthDateString;
        this.deathDateString    = personDataJSObj.deathDateString;

        var birthYearObj = unpackDateString(this.birthDateString);
        this.birthYear = birthYearObj.date;
        this.ageIsAppox = birthYearObj.isApprox;

        this.deathYear = unpackDateString(this.deathDateString).date;

       

        if(personDataJSObj.ruled != undefined )
        {
            this.ruled = [];
            for(let i=0; i<personDataJSObj.ruled.length; i++)
            {
                if(personDataJSObj.ruled[i]==undefined)
                {
                    this.ruled[i] = undefined;
                }
                else
                {
                    this.ruled[i] = unpackDateString(personDataJSObj.ruled[i]).date;
                }
            }
        }
    }

    /**
     * 
     * @param {number} yearInt using rounded int number
     * @returns {number} age of this person in a given year (should be integer)
     */
    ageAtYear(yearInt)
    {
        //need to handle AD/BC weirdness e.g. born in -1, current year 1 ==> 1 year old
        if(this.birthYear < 0 && yearInt > 0)
        {
            return (yearInt - this.birthYear) - 1;
        }
        return yearInt - this.birthYear;
    }

    /**
     * 
     * @param {number} yearInt year in whole-number form
     * @returns {boolean} alive status of this person in a given year
     */
    aliveInYear(yearInt)
    {
        //birth year unknown
        if(this.birthYear==undefined)
        {
            if(this.isRuling(yearInt))
            {
                return true;
            }
            else
            {
                return false;
            }
        }
        //default - birth year known
        return yearInt >= this.birthYear && (yearInt <= this.deathYear || this.deathYear==undefined );
    }

    /**
     * 
     * @param {number} yearInt year in whole number form
     * @returns {boolean} whether this person is ruling in given year
     */
    isRuling(yearInt)
    {
        var start, end;
        let i=0;
        while(i<this.ruled.length)
        {
            //read next pair of values from the array
            start = this.ruled[i++];
            end = this.ruled[i++]; //should be undefined if we run past the end of the array
            if(start <= yearInt && (end >= yearInt || end == undefined))
            {
                //person did rule in current year
                return true;
            }
        }
        return false; //default return false
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
     * @param {number} date as as the usual floating point date format
     * @returns {PersonData[]}  list of persons alive in the given year
     */
    PersonsAliveList(date)
    {
        var yearInt = dateInt(date); //date rounded to whole-year
        var alivelist = new Array();
        for(let i = 0; i<this.theList.length; i++)
        {
            if(this.theList[i].aliveInYear(yearInt))
            {
                alivelist.push(this.theList[i]);
            }
        }

        return alivelist;
    }

    /**
     * 
     * @param {number} date input year in usual floating point date
     * @returns {string} (HTML formatted) A summary string of the list of persons alive in given year
     */
    PersonsAliveStringHTML(date)
    {
        var alivelist = this.PersonsAliveList(date);
        var yearstr = dateString(date);

        var outstr = "<h3>Notable People in " + yearstr + "</h3>";
        for(let i=0; i<alivelist.length; i++)
        {
            var textline = this.PersonStringHTML(alivelist[i], date);

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
     * @param {PersonData} person 
     * @param {number} dateNumber  input date in floating point format
     * @returns { string } the HTML line summarizing this person in the given year
     */
    PersonStringHTML(person, dateNumber)
    {           
        var yearInt = dateInt(dateNumber); //the current date in whole-years

        var textline="";
        if(person.birthYear != undefined)
        {
            var age = Math.floor(person.ageAtYear(yearInt));
            textline = age + " years: " + person.name;
            if(person.ageIsAppox)
            {
                //add approx qualifier
                 textline = "~" + textline;
            }
          
        }
        else
        {
            textline = "Unknown age: " + person.name;
        }

        //italic if in death year
        if(person.deathYear != undefined && yearInt == person.deathYear)
        {
            textline = "<i>" + textline + " (year of death)" + "</i>";
        }
        else if(age == 0)
        {
            textline = "<i>" + textline + "</i>";
        }

        if(person.ruled != undefined )
        {
           /* var start = person.ruled[0];
            var end = person.ruled[1];//TODO modify to allow multiple spans
            if(start <= year && (end >= year || end == undefined))
            {
                //make line bold
                textline = "<b>" + textline + "</b>";
            }*/

            if(person.isRuling(yearInt))
            {                
                 textline = "<b>" + textline + "</b>";
            }
        }

        return textline;

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

class TimelineColumnWidget
{
    /**
     * @type {TimelineEvent[]}
     */
    col_tlEvents = [];

    /**
     * @type {string}
     */
    groupName;

    domElement;
    columnNumber;

    /**
     * 
     * @param {string} groupName 
     * @param {Timeline} timeline 
     */
    Init(groupName, timeline, initialColumn)
    {
        this.groupName=groupName;
        this.columnNumber = initialColumn;
        this.CreateDOMElement(timeline);

    }

    /**
     * 
     * @param {Timeline} timeline 
     */
    CreateDOMElement(timeline)
    {           
        this.domElement = document.createElement("div");
        this.domElement.setAttribute("class", "tlColumnWidget");  
        var widgetText=document.createTextNode(this.groupName);
        this.domElement.appendChild(widgetText);

        //TODO position the element (parent to timeline window) above the relevant column

        {
            //instead of adding text to the box, create a sub-element (label) and add the text to that

            // var newLabel = document.createElement("div");
            // newLabel.setAttribute("class", "yearLabel");         
            // newLabel.setAttribute("id", "presentDayLabel");                
            // var newEventText=document.createTextNode(jsonEventObj.title);
            // newLabel.appendChild(newEventText);

            // domElement.appendChild(newLabel);

        }
        // add to the document (use the container element of the table which allows overflow)
        if(timeline == mainTimeline) //TODO need a cleaner way to track which timeline is active
        {
            colHeaderDOMLeft[this.columnNumber].appendChild(this.domElement); //append to the column header
        }
        else
        {
            colHeaderDOMRight[this.columnNumber].appendChild(this.domElement); //append to the column header
        }
      //  document.getElementById("colHeader1").appendChild(this.domElement);
        //timeline.containerDom.parentNode.appendChild(this.domElement); //append to the 'mainBar' element
        // timeline.containerDom.appendChild(this.domElement); 
        // timeline.tableDom.appendChild(this.domElement); 

        //TODO make a box to contain multiple widgets. One box on top of each column ('columnHeader')

        // get timeline window position
        const rect = timeline.containerDom.getBoundingClientRect();

        //set position of widget
        this.domElement.style.top = rect.top + "px" - this.domElement.getBoundingClientRect().height;
        //position centeres above relevant column
        this.domElement.style.left = (
            rect.left 
            + (rect.width/3)*this.columnNumber    // center on column
            + rect.width/6 - this.domElement.getBoundingClientRect().width/2 // center widget
             ) 
            + "px";

        //this.domElement.style.width = rect.width/3 + "px";

        //TODO - make containers ('columnHeaders') for multiple widgets and arrange them within this box
    }

}

class Timeline {
    currentSelectedEventIndex = undefined;
    /**
     * @type {TimelineEvent[]}
     */
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

    /** @type {number} this can be a floating point value (for smooth dragging), TODO: better name would maybe be currentDate */
    currentYear = 0;    //TODO 0 is a placeholder for 1BC TODO TODO rename to currentDate
    oldCurrentYear;
    
    sliderScale;
    inverted=false;
    numColumns=3;
    availableColumns=[2,1,0];

    //the offset from the main timeline, if timelines are locked
    lockOffset=0;
    lockScaleOffset=0;

    /**
     * @type {HTMLDivElement}
     */
    tableDom;
    
    /**
     * @type {HTMLDivElement}
     */
    containerDom;

    /**
     * 
     * @param {HTMLDivElement} tableDom 
     * @param {number} timelineIndex 
     */
    constructor(tableDom, timelineIndex)
    {
        /**
         * 
         * @type {HTMLDivElement}
         * e.g. "mainTable"
         */
        this.tableDom = tableDom; //TODO replace all references to getElementbyID("mainTable")
        /**
         * 
         * @type {HTMLDivElement}
         * e.g. the "tableContainer"
         */
        this.containerDom = tableDom.parentNode;
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
        if(jsonObj.preferredColumn != undefined)
        {
            currentColumn = Number(jsonObj.preferredColumn);
            removeItemOnce(this.availableColumns, currentColumn);
            //this.availableColumns.remove(currentColumn)
            //TODO make next available column currentColumn+1 (looping around after max)
        }
        else if(this.availableColumns.length > 0)
        {
            currentColumn = this.availableColumns.pop();
        }
        else
        {
            //need to free up a column or something
            // check overlaps
        }

        // make a widget for the selected column
        var newWidget =  new TimelineColumnWidget();
        newWidget.Init(jsonObj.category, this, currentColumn);
    
        for(let i=0; i<jsonObj.eventlist.length; i++)
        {
            var jsonEventObj = jsonObj.eventlist[i];        
            var eventDate, eventEndDate, eventBirthDate, eventDeathDate, eventType;
    
            eventDate = unpackDateString(jsonEventObj.dateString).date ; //convert to numerical (so can sort, among other things)
            
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

            if(eventType=="horizline")
            {
                //instead of adding text to the box, create a sub-element (label) and add the text to that
                var newLabel = document.createElement("div");
                newLabel.setAttribute("class", "yearLabel");         
                newLabel.setAttribute("id", "presentDayLabel");                
                var newEventText=document.createTextNode(jsonEventObj.title);
                newLabel.appendChild(newEventText);

                newEventDomElement.appendChild(newLabel);
            }
            else
            {
                var newEventText=document.createTextNode(jsonEventObj.title);
                newEventDomElement.appendChild(newEventText);
            }
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
        //this.recentreTimeline(); //this is conflicting with set default scale (below) when including other json data

        if(jsonObj.personlist != undefined)
        {
            // load person list
            for(let i=0; i<jsonObj.personlist.length; i++)
            {
                //var newPerson = new PersonData(jsonObj.personlist[i])
                this.personlist.Insert(jsonObj.personlist[i]);
            }
        }


        if(jsonObj.defaultDateString != undefined)
        {
            var defaultDate = unpackDateString(jsonObj.defaultDateString).date;
            this.SetCurrentYear(defaultDate);
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

    /**
     * recalculates the positions of all the timeline elements
     */
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
            if(_tlevent.maxScale > 0 && this.currentScale >= _tlevent.maxScale){
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
            if(_tlevent.type=="horizline")
            {
                //set position as with default event
                setPosition(_tlevent.domElement, offset);

            }
            //position in preferred column
            this.setColumn(_tlevent, _tlevent.preferredColumn);
        }
    
        
        this.currentYearLabelDom.innerHTML = dateString(this.currentYear); //refresh the year labels
        this.minYearLabelDom.innerHTML = dateString(this.currentMin); 
        this.maxYearLabelDom.innerHTML = dateString(this.currentMax); 
        //TODO other labels
    }

    /**
     * 
     * @param {TimelineEvent} _tlevent 
     * @param {number} columnNumber 
     */
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
            else if(_tlevent.type=="horizline")
            {
                leftoffset = 0; //TODO make this disregard the column (always put in left)
                _tlevent.domElement.style.width = "100%";

            }
            else if(_tlevent.type=="person")
            {
                leftoffset = 1.2; //to center the events; use 0 to left align

                // set lifeline column
                _tlevent.lifelineDomElement.style.left = ((columnNumber + leftoffset)*width) + "%";
            }
            _tlevent.domElement.style.left = ((columnNumber + leftoffset)*width) + "%";

            //console.log("Set column width to " + width);
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
        this.SetCurrentYear(midpoint);
    
        var newScale = (date1 - date0);
        this.setCurrentScale(newScale);
    
        //refresh();
    }

    /**
     * 
     * @param {number} newScale the value to set the scale to
     * @param {boolean} propagate scale all the locked timelines accordingly
     */
    setCurrentScale(newScale, propagate=true)
    {
      //  console.log("Setting scale " + newScale);
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
        
        /* update the HTML field */
        /* TODO maybe a generic UIChanged() / updateUI() function would clean this up */
        updateScaleInput();
        RefreshPersonPanel();
    }

    /**
     * 
     * @param {number} newYear updates the current year to this value
     * @param {boolean} propagate also update accordingly timelines that are locked to this one
     */
    SetCurrentYear(newYear, propagate=true)
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
                    //all_timelines[i].SetCurrentYear(mainTimeline.currentYear + offset, false);
                    if(all_timelines[i].inverted)
                    {
                        all_timelines[i].SetCurrentYear(-this.currentYear, false);
                    }
                    else
                    {
                        all_timelines[i].SetCurrentYear(this.currentYear, false);
                    }
                    all_timelines[i].refresh();
                }
            }
        }

        //update the HTML field
        updateYearInput();
        //update the HTML in the person panel
        //TODO maybe need a callback/event handler
        RefreshPersonPanel();
    } 




}  


// Handle timeline animation
var animTargetDate;
var animProgress;
var animID;

/**
 * @type {Timeline}
 */
var animTimeline;

function AnimateMove()
{
    animProgress += ANIMATION_INTERVAL/ANIMATION_TIME;
    if (animProgress < 1.0) {
        //lerp between old date and new date...
        var newYear = myLerp( animTimeline.oldCurrentYear, animTargetDate, animProgress);
        animTimeline.SetCurrentYear(newYear);
    }
    else
    {
        // end 

        animTimeline.SetCurrentYear(animTargetDate);
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
    /**
     * 
     * @param {string} title 
     * @param {number} date 
     * @param {number} endDate 
     * @param {number} birthDate 
     * @param {number} deathDate 
     * @param {string} searchstring 
     * @param {string} type 
     * @param {number} minScale this is a lower bound (inclusive) - event should be visible at this scale and above (if less than maxScale)
     * @param {number} maxScale this is an upper bound (not inclusive) - event will NOT be visible at this scale or above
     * @param {HTMLDivElement} domElement 
     * @param {HTMLDivElement} lifelineDomElement 
     * @param {number} preferredColumn 
     */
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

/**
 * THIS is the function that gets called when the page loads
 */
function loadSelectorOptions()
{
    initTimelines(); //better to just do this first

    console.log("Loading selector options");
    readJSONFile(TIMELINES_SELECTOR_FILE, createAllSelectorOptions);

}

function createAllSelectorOptions(jsonObj)
{    
    var selectorDOM = document.getElementById("timelineSelect");
    var selectorDOM_second = document.getElementById("timelineSelect2");
    createSelectorOptions(jsonObj, selectorDOM);
    createSelectorOptions(jsonObj, selectorDOM_second);


    
    //load default timeline (1st in list)
    loadTimeline("timelines/events_recent.json", mainTimeline); //TODO change this from hardcoded file
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

function timelineSelectorChanged(timelineIndex, timelineFile)
{    
   /* if(mainTimeline==undefined)
    {
        initTimelines();    //SHOULD initialize all timelines
    }*/

    var targetTimeline = mainTimeline;
    if(timelineIndex==1)
    {
        targetTimeline = secondTimeline;
    }

    loadTimeline(timelineFile, targetTimeline);
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
    mainTimeline.SetCurrentYear(unpackDateString(yearInputDOM.value).date);
}

// update the value of the HTML year field
function updateScaleInput()
{
    var dom = document.getElementById("scaleInput");
   // const formattedNumberEN = new Intl.NumberFormat('fr-FR').format(mainTimeline.currentScale);
    const formattedNumberEN = new Intl.NumberFormat('en-US').format(mainTimeline.currentScale);

    dom.value = formattedNumberEN;
}

//update the current year FROM the HTML field
function submitScaleInput()
{
    var dom = document.getElementById("scaleInput");
    mainTimeline.setCurrentScale(dom.value);
}

function initTimelines()
{
    //init variables
    
    colHeaderDOMLeft =  [ 
        document.getElementById("colHeader1"),
        document.getElementById("colHeader2"),
        document.getElementById("colHeader3"),
        //skip 4 (central column)
    ];    
    
    colHeaderDOMRight =  [ 
        document.getElementById("colHeader5"),
        document.getElementById("colHeader6"),
        document.getElementById("colHeader7") 
    ];


    mainTimeline = new Timeline(document.getElementById("mainTable"), 0);
    secondTimeline = new Timeline(document.getElementById("secondTable"), 1);

    secondTimeline.inverted=false;

    //set initial focus
    mainTimeline.selectTable();

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
    if(targetTimeline==undefined)
    {
        initTimelines();    //SHOULD initialize all timelines
    }

    //clear current selection
    targetTimeline.clearEventSelection();

    console.log("Loading from " + timelineFile);
    readJSONFile(timelineFile, loadTimelineFromJSON, targetTimeline);
}

/**
 * 
 * Load this data into the Timeline obj and create the event bubbles
 * 
 * @param {Object} jsonObj the JSON data
 * @param {Timeline} targetTimeline the Timeline to load the data into
 */
function loadTimelineFromJSON(jsonObj, targetTimeline)
{
    //load events from this JSON file
    targetTimeline.createEventBubbles(jsonObj, false);
    
    //refresh the persons alive list
    RefreshPersonPanel();

    //now load the included files
    if(jsonObj.includefiles != undefined)
    {
        for(let i=0; i<jsonObj.includefiles.length; i++)
        {
        // load the next timeline 
        // (will recursively call this function for each JSON file read successfully)
        loadTimeline(jsonObj.includefiles[i], targetTimeline);
        }
    }
}

/**
 * 
 * Load data into the Timeline obj and create the event bubbles
 * 
 * @param {string} jsonfile the JSON file to read the data from
 * @param {Function} onFinishCallback the function to call when the file has been fetched
 * @param {Timeline} targetTimeline the Timeline to load the data into
 */
function readJSONFile(jsonfile, onFinishCallback, targetTimeline)
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
 * @returns {number} the current, real-world year (UTC)
 */
function datePresentDay()
{
    const date = new Date();
    const presentYear = date.getUTCFullYear();
    return presentYear;
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
        return unpackDateString(dateString).date;
    }
}

/**
 * 
 * create date int from string in format "[year]" or "[year] BC"
 * 
 * @param {string} dateString the input string 
 * @returns {{date: number | undefined, isApprox: boolean}} the year as an integer and whether it is approximate
 */
function unpackDateString(dateString)
{
    var isApprox = false;
    var dateInt; //return value

    if(dateString==undefined)
    {
        dateInt = undefined;
    } 
    else if(dateString == "PRESENTDAY")
    {
        dateInt = datePresentDay();
        isApprox = false;
    }
    else
    {        

    //    var tokens = dateString.split(" ");
        var tokens = dateString.match(/\S+/g); //split string by whitespace

        if(tokens[0].toLowerCase() == "c." || tokens[0].toLowerCase() == "c"|| tokens[0].toLowerCase() == "~")
        {
            //date is approx
            isApprox = true;
            tokens=tokens.slice(1); // remove first element from array and continue.
        }

        if(tokens[1] && tokens[1].toLowerCase() == "bc")
        {
            dateInt = tokens[0] * -1; //TODO this is temprary - it will cause an off by 1 error when calculating date differences
        }
        else
        {
            dateInt = tokens[0];
        }
    }
    return {
        date: dateInt, 
        isApprox: isApprox
    };
}

/**
 * 
 * create date string from number;
 * use this for most purposes
 * 
 * Dates round up if AD, down if BC
 * NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
 * All dates in the range (0, 1] count as 1 AD
 * 
 * @param {number} dateNumber the input date as number (expects floating point value)
 * @returns {string} the usual string format of this date (e.g. Ma, AD or BC)
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
 * Dates round up if AD, down if BC
 * NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
 * All dates in the range (0, 1] count as 1 AD
 * 
 * @param {number} dateNumber the input date as number (expects floating point value) 
 * @returns {string} the 'AD/BC' string of the date (AD omitted if date is later than 999 AD)
 */
function dateGregorian(dateNumber)
{   
    var date = Number(dateNumber);
    var str;
    if(date <= 0)
    {
        str = -dateInt(date)+ " BC"; //so -0.1, -1 becomes '1 BC'. NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
    }
    else if(date < 1000)
    {
        str = dateInt(date) + " AD"; //so 0.1, 0.5, 1 becomes '1 AD'. All dates in the range (0, 1] count as 1 AD
    }
    else
    {
        str = dateInt(date) + ""; //so 1000 becomes '1000'
    }

    return str;

}

/**
 * 
 * @param {number} dateNumber 
 * @returns input date, rounded to correct year
 */
function dateInt(dateNumber)
{
    var dateRounded;
    if(dateNumber <= 0)
    {
        dateRounded = Math.floor(dateNumber); //so -0.1 becomes -1, etc.; only dates in the range [-1, 0) count as -1 (i.e. 1 BC)
    }
    else
    {
        dateRounded = Math.ceil(dateNumber); //round to integer above. 0.1 becomes 1.
    }

    return dateRounded;
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
function RefreshPersonPanel()
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

       //var aliveListText = selectedTimeline.personlist.PersonsAliveString(selectedTimeline.GetCurrentYearInt());
  //     var aliveListHTML = selectedTimeline.personlist.PersonsAliveStringHTML(
 //       selectedTimeline.GetCurrentYearInt());//TODO this may need fixing for consistency - dateIntGregorian uses Math.ceil() instead of floor()
       
       
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

    targetTimeline.SetCurrentYear(targetTimeline.oldCurrentYear - draggedYearsAmount);


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

//helpers

function myLerp(x,y, a)
{
    return x*(1-a) + y*a;
}

/**
 * 
 * @param {*[]} arr an array
 * @param {*} value value to be removed from the array
 * @returns 
 */
function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

/**
 * 
 * @param {*[]} arr an array
 * @param {*} value value to be removed from the array
 * @returns 
 */
function removeItemAll(arr, value) {
  var i = 0;
  while (i < arr.length) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
}
/**
 * Bugtracker
 * 
 * 1. Lifelines should disappear when the event bubble disappears (out of scale range)
 * 
 * 2. Lifelines should only appear when big enough to be meaningful
 * 
 * 3. Add num columns to table definition; timeline events can then be assigned a column number. 
 *      Optional: reserve an 'empty' column on the right for persons
 * 
 */