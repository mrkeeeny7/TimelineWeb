

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

var dragOverCounter=0;


const MIN_SCALE = 10;        //years
const MAX_SCALE = 1e10;      //years
var minZoom = Math.log(MIN_SCALE / 500.0);
var maxZoom = Math.log(MAX_SCALE / 500.0);

const TIMELINES_SELECTOR_FILE = "timelines/timeline_list.json";
const PERSON_DATABASE_FILE = "timelines/persons_DB.json";
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
     * unique ID
     * @type {string}
     */
    id;

    /**
     * supports more exotic types of lifetimes: species, monuments, geographic features, planets, stars
     * defaults to 'person'
     * @type {string}
     */
    lifetimeType;

    /**
     * @type {string}
     */
    name;

    /**
     * @type {TimelineDate}
     */
    birthDate;
    /**
     * @type {TimelineDate}
     */
    deathDate;


    /**
     * @type {number[]}
     * array of dates corresponding to the time this person was a 'ruler', if any
     */
    ruled;


    /**
     * @type {boolean}
     */
    //isNotDead; //DEPRECATED - use getter

    /**
     * @constructor
     * @param {{name: string, birthDateString: string, deathDateString: string} personDataJSObj}
     */
    constructor(personDataJSObj)
    {
        this.id                 = personDataJSObj.id; //may be undefined
        this.name               = personDataJSObj.name;
        var bdString    = personDataJSObj.birthDateString;
        var ddString    = personDataJSObj.deathDateString;

        if(personDataJSObj.lifetimeType != undefined)
        {
            this.lifetimeType = personDataJSObj.lifetimeType;
        }
        else
        {
            this.lifetimeType = 'person';
        }

        // override birthdate / deathdate with "lived[]" data
        if(personDataJSObj.lived != undefined)
        {
            if(personDataJSObj.lived.length == 1)
            {
                //use the date as birth date and assume death date undefined (is still living)
                
                bdString=personDataJSObj.lived[0];
                ddString=undefined;
            }
            else if(personDataJSObj.lived.length == 2)
            {
                bdString=personDataJSObj.lived[0];
                ddString=personDataJSObj.lived[1];
            }
            else
            {
                let errorStr = "Badly formatted data - need a birth date and death date for " + this.name;
                console.error(errorStr);
                throw new error(errorStr);
            }
        }

        this.birthDate = new TimelineDate(bdString);

        if(ddString == undefined)
        {
            this.deathDate = undefined;
           // this.isNotDead = true; // this may be redundant if we take undefined death year as still living
        }
        else
        {
            let dthStr = ddString.toLowerCase();
            if(dthStr =="alive" || dthStr=="living" || dthStr == undefined)
            {
                this.deathDate = undefined;
             //   this.isNotDead = true; // this may be redundant if we take undefined death year as still living
            }
            else
            {
                this.deathDate = new TimelineDate(ddString);
                if(this.deathDate.date == undefined)
                {
                    throw new Error (this.name + ": Death year could not be parsed");
                }
              //  this.isNotDead = false;
            }
        }
       

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
                    this.ruled[i] = new TimelineDate(personDataJSObj.ruled[i]).date;
                }
            }
        }
    }

    get ageIsApprox()
    {
        return this.birthDate.isApprox;
    }

    get isNotDead()
    {
        return this.deathDate == undefined;
    }

    /**
     * 
     * @param {number} yearInt using rounded int number
     * @returns {number} age of this person in a given year (should be integer)
     */
    ageAtYear(yearInt)
    {
        return TimelineDate.yearDifference(this.birthDate.date, yearInt);
    }

    /**
     * 
     * @param {number} yearInt year in whole-number form
     * @returns {boolean} alive status of this person in a given year
     */
    aliveInYear(yearInt)
    {
        //birth year unknown
        if(this.birthDate.date==undefined)
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
        return this.ageAtYear(yearInt) >= 0 && (this.isNotDead|| yearInt <= this.deathDate.date );
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

    
    infoBlock()
    {
        //block to return
        var infoBlock = document.createElement("div");
        infoBlock.setAttribute("class", "personInfoBlock");

        //paragraph 1
        var lifetimePara = document.createElement("span");
        let lifetimetext = "Lived: " 
        + ( this.birthDate.makeString() )
        + " to " ;

        var maxAge;

        if(this.isNotDead)
        {
            lifetimetext = lifetimetext + "present";            
            maxAge = this.ageAtYear(TimelineDate.PresentDay());
        }
        else
        {
            if(this.deathDate==undefined) //check
            {
                throw new Error("Non-living person " + this.name + " has no defined death date.");
            }

            lifetimetext = lifetimetext +  ( this.deathDate.makeString() );
            maxAge = this.ageAtYear(this.deathDate.date);
        }

        lifetimetext = lifetimetext + " (" + TimelineDate.timespanString(maxAge) + " years).";

        lifetimePara.appendChild(document.createTextNode(lifetimetext));
        infoBlock.appendChild(lifetimePara);


        //paragraph 2

        if(this.ruled != undefined)
        {
            var start, end;
            let i=0;
            const lineBegin = "Ruled: ";
            while(i<this.ruled.length)
            {
                var ruledPara = document.createElement("span");
                //read next pair of values from the array
                start = this.ruled[i++];
                end = this.ruled[i++]; //should be undefined if we run past the end of the array

                if(end==undefined)
                {
                    end = TimelineDate.PresentDay(); //TODO, should really just put PRESENTDAY in the data
                }

                let ruledstr = TimelineDate.dateString(start) + " to " + TimelineDate.dateString(end) 
                    + " (" + Number(end-start) + " years).";

                ruledPara.appendChild(TimelineHelper.BoldBlock(lineBegin));
                ruledPara.appendChild(document.createTextNode(ruledstr));

                infoBlock.appendChild(document.createElement("br"));
                infoBlock.appendChild(ruledPara);
            }
            
        }

        return infoBlock;

    }
    

}

class PersonDatabase {
    static personMap = new Map();

    /**
     * 
     * @param {string} id 
     * @param {PersonData} person 
     */
    static Add(id, person)
    {
        if(this.personMap.get(id) != undefined)
        {
            throw new Error("Person ID is not unique: " + id);
        }

        this.personMap.set(id, person);
    }

    static Get(id)
    {
        return this.personMap.get(id);
    }

    static LoadFromJSON(jsonData, _)
    {
        for(let i=0; i<jsonData.list.length; i++)
        {
            let newPerson = new PersonData(jsonData.list[i]);
            PersonDatabase.Add(newPerson.id, newPerson);
        }
    }

    static LoadFromFile(jsonFilePath)
    {
        
        console.log("Loading from " + jsonFilePath);
        readJSONFile(jsonFilePath, this.LoadFromJSON, undefined);
    }
}

class PersonListSorted {

    /**
     * @type {PersonData[]}
     */
    theList = []; //for now, just use an array and sort() when inserting. TODO implement better if necessary

    /**
     * @type {string}
     */
    headerString;

    constructor(headerString)
    {
        this.headerString = headerString;
    }

    /**
     * 
     * @param {Object} jsonPersonObj 
     * @returns {PersonData} the new person data created
     */
    Insert(jsonPersonObj)
    {
        var newPerson;

        // check if we are loading from the database
        if(jsonPersonObj.id != undefined)
        {
            //first check if the person is already in this list (do not duplicate)
            let foundPerson = this.theList.find(p => p.id === jsonPersonObj.id);
            if(foundPerson != undefined)
            {
                //skip adding to the list, it is already present
                return foundPerson;
            }

            //check if the person is in the database
            newPerson = PersonDatabase.Get(jsonPersonObj.id);
            if(newPerson==undefined)
            {
                throw new Error("Person ID not found in database: " + jsonPersonObj.id);
            }

        }
        else
        {
            // create new person data
            newPerson = new PersonData(jsonPersonObj);
        }

        //now add to this list
      //  if(this.theList.length == 0)
      //  {
      //      this.theList.push(newPerson);
       // }
      //  else
        if(newPerson.birthDate.date == undefined)
        {
            //skip inserting to the list, as we cannot sort it
            console.warn("Person data not inserted to list due to missing birth date: " + newPerson.name);
        }
        else
        {
            this.theList.push(newPerson);

            //TODO only sort if new person is in the wrong order
            //TODO or could just insert at the correct position by iterating
            this.SortListByAge();
        }

        return newPerson;
    }

    //for debug
    PrintListOrder()
    {
        console.log("Current list order: ");
        var str="";
        for(let i=0; i<this.theList.length; i++)
        {
            let person = this.theList[i];
            str = str + person.name+ "(born " + person.birthDate.date + "); ";
        }
        console.debug(str);
    }

    //throws an error if list is not correctly sorted
    AssertListOrder()
    {
        if(this.theList.length<2)
        {
            return;
        }
        for(let i=0; i<this.theList.length-1; i++)
        {
            let person0 = this.theList[i];
            let person1 = this.theList[i+1];

            if(person0.birthDate.date > person1.birthDate.date)
            {
                throw new error("Person list is not correctly sorted.");
            }
        }
        
    }


    SortListByAge()
    {
        this.theList.sort(
            function(a,b) {
                return -TimelineDate.yearDifference(a.birthDate.date, b.birthDate.date); //invert the answer to flip the list order
                //return a.birthDate.date - b.birthDate.date; 
                }
        );

        //debug
        this.PrintListOrder();
        this.AssertListOrder();
    }

    /**
     * 
     * @param {number} date as as the usual floating point date format
     * @returns {PersonData[]}  list of persons alive in the given year
     */
    PersonsAliveList(date)
    {
        var yearInt = TimelineDate.dateRound(date); //date rounded to whole-year
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
     * DEPRECATED **** use CurrentYearReport instead
     * TODO ** THIS NEEDS TO BE REPLACED, RETURNING HTML ELEMENT INSTEAD OF HTML CODE
     * 
     * @param {number} date input year in usual floating point date
     * @returns {string} (HTML formatted) A summary string of the list of persons alive in given year
     */
    PersonsAliveStringHTML(date)
    {
        var alivelist = this.PersonsAliveList(date);
        var yearstr = TimelineDate.dateString(date);

        var outstr = "<h3>Notable People in " + yearstr + "</h3>";
        for(let i=0; i<alivelist.length; i++)
        {
           // var textline = this.PersonStringHTML(alivelist[i], date);
            var textline = this.PersonHTMLElement(alivelist[i], date).textContent;

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
     * Replacement for PersonsAliveStringHTML: Will produce a report of persons alive or current species, etc.
     * depending on current date and zoom level
     * 
     * @param {number} date 
     * @returns {HTMLElement} the formatted block containing the report
     */
    CurrentYearReport(date)
    {
        //create an HTML element with a formatted list

        var alivelist = this.PersonsAliveList(date);
        var yearstr = TimelineDate.dateString(date);

        var reportElement = document.createElement("div");

        // for now, just return an empty div element if there are no entries in the list
        if(alivelist.length==0)
        {
            return reportElement;
        }

        var headerElt = document.createElement("h3");        
       // headerElt.textContent = "Notable People in " + yearstr;
        headerElt.textContent = this.headerString + yearstr;
        
        reportElement.appendChild(headerElt);


        for(let i=0; i<alivelist.length; i++)
        {
            var personElement = this.PersonHTMLElement(alivelist[i], date);
            reportElement.appendChild(personElement);
            reportElement.appendChild(document.createElement("br")); // add a line break
        }

        return reportElement;
    }    

    /**
     * DEPRECATED **** use PersonHTMLElement instead
     * @param {PersonData} person 
     * @param {number} dateNumber  input date in floating point format
     * @returns { string } the HTML line summarizing this person in the given year
     */
    PersonStringHTML(person, dateNumber)
    {           
        var yearInt = TimelineDate.dateRound(dateNumber); //the current date in whole-years

        var textline="";
        if(person.birthDate.date != undefined)
        {
            var age = Math.floor(person.ageAtYear(yearInt));
            var ageString = TimelineDate.timespanString(age);
            textline = ageString + " years old: " + person.name;
            if(person.ageIsApprox)
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
        if(person.deathDate != undefined && yearInt == person.deathDate.date)
        {
            textline = "<i>" + textline + " (year of death)" + "</i>";
        }
        else if(age == 0)
        {
            textline = "<i>" + textline + "</i>";
        }

        if(person.ruled != undefined )
        {
            if(person.isRuling(yearInt))
            {                
                 textline = "<b>" + textline + "</b>";
            }
        }

        return textline;

    }

    PersonHTMLElement(person, dateNumber)
    {           
        var personElement = document.createElement("span");

        var yearInt = TimelineDate.dateRound(dateNumber); //the current date in whole-years

        var textline="";
        if(person.birthDate.date != undefined)
        {
            var age = Math.floor(person.ageAtYear(yearInt));
            var ageString = TimelineDate.timespanString(age);
            textline = ageString + " years old: ";
            if(person.ageIsApprox)
            {
                //add approx qualifier
                 textline = "~" + textline;
            }
          
        }
        else
        {
            textline = "Unknown age: ";
        }

        personElement.textContent = textline;

        //add the name
        var nameelt = document.createTextNode(person.name);
        if(person.lifetimeType=="species")
        {
            //italicise the names of species/genera
            nameelt = TimelineHelper.ItalicBlock(person.name);
        }
        personElement.appendChild(nameelt);

        //italic if in death or birth year
        if(person.deathDate != undefined && yearInt == person.deathDate.date)
        {
            personElement.appendChild(document.createTextNode( " (year of death)"));
            personElement = TimelineHelper.CreateParentNode("i", personElement); //make italic
        }
        else if(age == 0)
        {
            personElement = TimelineHelper.CreateParentNode("i", personElement); //make italic
        }

        if(person.ruled != undefined )
        {
            if(person.isRuling(yearInt))
            {                
                // make the line bold
                personElement = TimelineHelper.CreateParentNode("b", personElement);
            }
        }

        return personElement;

    }
    
    /**
    * UNUSED (Deprecated)
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
           var textline = age + " years young: " + alivelist[i].name;

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
    colorString;

    /**
     * @type {boolean}
     */
    isEnabled = true;

    /**
     * @type {Timeline}
     * the timeline this widget belongs to
     */
    timeline;

    /**
     * 
     * @param {string} groupName 
     * @param {Timeline} timeline 
     */
    Init(groupName, timeline, initialColumn, colorString)
    {
        this.timeline = timeline;
        this.groupName=groupName;
        this.columnNumber = initialColumn;
        this.colorString = colorString;
        this.CreateDOMElement();

    }

    /**
     * 
     * 
     */
    CreateDOMElement()
    {           
        let elementID = "columnWidget" + this.groupName;

        this.domElement = document.createElement("div");
        this.domElement.setAttribute("class", "tlColumnWidget"); 
        this.domElement.setAttribute("id", elementID);  //TODO really need to ensure this is unique; maybe maintain a hashtable reference
        this.domElement.setAttribute("category", this.groupName);  //use this in the callback below

        //make draggable
        this.domElement.setAttribute("draggable", "true"); 
        this.domElement.setAttribute("ondragstart", "dragstartHandler(event)");

        //other widgets may be dragged onto this, need to define this behaviour
        makeDraggableTarget(this.domElement);

        var widgetText=document.createTextNode(this.groupName);
        this.domElement.appendChild(widgetText);
        this.refreshColours();

        let tI = this.timeline.timelineIndex;

        //add the onClick callback
        this.domElement.addEventListener("click", 
            function() { 
                //TODO check that this timelineIndex works for both
                onCategoryClick(tI, this.getAttribute("category")); 
            }
        );
           

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
        this.timeline.columnHeaderDOM[this.columnNumber].appendChild(this.domElement); //append to the column header

      //  document.getElementById("colHeader1").appendChild(this.domElement);
        //timeline.containerDom.parentNode.appendChild(this.domElement); //append to the 'mainBar' element
        // timeline.containerDom.appendChild(this.domElement); 
        // timeline.tableDom.appendChild(this.domElement); 

        //TODO make a box to contain multiple widgets. One box on top of each column ('columnHeader')

        // get timeline window position
        const rect = this.timeline.containerDOM.getBoundingClientRect();

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

    toggleEnabled()
    {
        this.isEnabled = !this.isEnabled;
        this.domElement.setAttribute("isEnabled", this.isEnabled);

        this.refreshColours();
            
        //now loop through all the events in this Timeline and show/hide the ones that are in disabled categories
        //e.g. use isEnabled (or isHidden) attribute
        this.timeline.refresh();
    }

    refreshColours()
    {       
        //NB this overrides the setting in style.css
        if(this.isEnabled)
        {
            if(this.colorString!=undefined)
            {
                this.domElement.style.backgroundColor = this.colorString;
                this.domElement.style.color = "white";
            }
            else
            {
                this.domElement.style.backgroundColor = "lightblue";
                this.domElement.style.color = "darkblue";
            }
        }
        else
        {            
            this.domElement.style.backgroundColor = "lightgrey";
            this.domElement.style.color = "grey";
        }

    }

}

class Timeline {
    currentSelectedEventIndex = undefined;
    /**
     * @type {TimelineEvent[]}
     */
    tlEvents = [];


    //track overlapping events (stacks)
    /**
     * @type {TimelineEvent[]}
     */
    eventStacks = [[],[],[]]; //for 3 columns TODO use dynamic creation for # columns

    /**
     * @type {PersonListSorted}
     */
    personlist = new PersonListSorted("Notable people in ");
    specieslist = new PersonListSorted("Extant species and genera in ");

    /**
     * @type {TimelineColumnWidget[]}
     * indexed by category name
     */
    tlCategories = [];
    

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
   // numColumns=3;
    availableColumns=[2,1,0]; //TODO deprecate

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
    containerDOM;

    /**
     *  @type {HTMLElement[]} 
     * 
     */
    columnHeaderDOM;

    /**
     * @type {TimelineSelector[]}
     */
    timelineSelectors;

    /**
     * 
     * @param {HTMLDivElement} tableDom 
     * @param {number} timelineIndex 
     */
    constructor(tableDom, headerIDs, timelineIndex)
    {
        all_timelines[timelineIndex] = this;

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
        this.containerDOM = tableDom.parentNode;
        this.timelineIndex = timelineIndex;

        this.currentYearLabelDom = document.getElementById("currentYearLabel" + timelineIndex);
        this.minYearLabelDom = document.getElementById("minYearLabel" + timelineIndex);
        this.maxYearLabelDom = document.getElementById("maxYearLabel" + timelineIndex);

        //set the headers first; this will also set the number of columns
        this.SetHeaders(headerIDs);

        //create the selectors; options to be added later        
        this.CreateColumnSelectors();


        //all_timelines.push(this);
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

    getNumColumns()
    {
        return this.columnHeaderDOM.length; 
      //  return this.numColumns;
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
        //UpdateInfoPanelWikpedia();
        //UpdateInfoPanelWikpedia2();
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

    deselectTable()
    {

        //clear current event selection
        this.clearEventSelection();

        // deselect the timeline
        selectedTimeline = undefined;
        this.tableDom.setAttribute("selected", false);
    }

    /**
     * Creates the selector DOM for each columb but does not yet add the options
     */
    CreateColumnSelectors()
    {
        this.timelineSelectors=[];
        for(let i=0; i<this.getNumColumns(); i++)
        {
            this.timelineSelectors[i] = new TimelineSelector(this.timelineIndex, i); 
        }
    }

    /**
     * Adds the options from JSON data to the selectors in each column
     * @param {JSON} jsonObj 
     */
    AddSelectorOptions(jsonObj){

        //add options to selector in each column
        for(let i=0; i<this.timelineSelectors.length; i++)
        {
            this.timelineSelectors[i].CreateOptions(jsonObj);
        }

    }

    /**
     * 
     * de facto, this loads data fronm the json obj
     * TODO load Person data from person list into a local list of persons
     * 
     * @param {Object} jsonObj the JSON data for this timeline
     * @param {boolean} clearExistingFlag whether to clear existing data before loading new data
     */
    CreateEventBubbles(jsonObj, clearExistingFlag)
    {
        //var eventsString = "";
        //eventsString += jsonObj.category + ": ";
    
        if(clearExistingFlag)
        {
            //clear existing stuff
           // this.tlEvents = [];
            this.tlEvents.length = 0;
      
        
            //remove existing eventBubbles
            var bubbles = this.tableDom.getElementsByClassName("eventBubble");
            for(let i=bubbles.length-1; i>=0; i--) //go from the end backwards to avoid weird iteration bugs
            {
                bubbles[i].remove();
            }
        
         }

         // find an available column for this list
        var currentColumn=0;

        if(this.availableColumns.length > 0) //go to available columns first
        {
           //currentColumn = this.availableColumns.pop();
            currentColumn = this.availableColumns[0];
        }
        else if(jsonObj.preferredColumn != undefined)
        {
            currentColumn = Number(jsonObj.preferredColumn);
            TimelineHelper.removeItemOnce(this.availableColumns, currentColumn);
            //this.availableColumns.remove(currentColumn)
            //TODO make next available column currentColumn+1 (looping around after max)
        }
        else 
        {
            //need to free up a column or something
            // check overlaps
        }

        // make a widget for the selected column
        var newColumnWidget =  new TimelineColumnWidget();
        this.tlCategories[jsonObj.category] = newColumnWidget;
        newColumnWidget.Init(jsonObj.category, this, currentColumn, jsonObj.colorString);
    
        var eventIndex = this.tlEvents.length; //start at the end of the existing list TODO clean this up (use AddEvent method)

        for(let i=0; i<jsonObj.eventlist.length; i++)
        {
            var jsonEventObj = jsonObj.eventlist[i];        
            this.CreateBubble(
                jsonEventObj, 
                undefined,
                jsonObj.category, //TODO consider just passing in the jsonObj
                newColumnWidget, 
                jsonObj.colorString, 
                jsonObj.colorBString, 
                eventIndex++,
                currentColumn);
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
                let jsonPersonData = jsonObj.personlist[i];
                let newPersonData;
                if(jsonPersonData.lifetimeType=="species")
                {
                     newPersonData = this.specieslist.Insert(jsonPersonData);
                }
                else{
                     newPersonData = this.personlist.Insert(jsonPersonData);
                }
                // Create extra event bubbles for persons
                if(jsonPersonData.bubbleDate != undefined)
                {
                    let maxScale = 500;
                    let minScale = 0;
                    if(jsonPersonData.bubbleScale != undefined)
                    {
                        minScale = jsonPersonData.bubbleScale[0];
                        maxScale = jsonPersonData.bubbleScale[1];
                    }
                    // create a bubble
                    let newEventData = { 
                        //mimic the event data for a normal (non-person) event
                        title: newPersonData.name,
                        //extra info
                        subtitle: jsonPersonData.subtitle,
                        location: jsonPersonData.location,

                        dateString: jsonPersonData.bubbleDate, //note: use this data from json (will not exist in person database)
                        birthDateString : newPersonData.birthDate==undefined? undefined : newPersonData.birthDate.dateString,
                        deathDateString : newPersonData.deathDate==undefined? undefined : newPersonData.deathDate.dateString,
                        maxScale : maxScale,
                        minScale : minScale,
                        type : "person",
                    };
                    
                    //TODO revamp CreateBubble to clean this up - just pass in a reference to the PersonData

                    let newEvent = this.CreateBubble(
                        newEventData, //make sure this has all the needed data 
                        newPersonData,
                        jsonObj.category, //TODO consider just passing in the jsonObj
                        newColumnWidget, 
                        jsonObj.colorString, 
                        jsonObj.colorBString, 
                        eventIndex++,
                        currentColumn);

                    newEvent.personData = newPersonData;
                    
                }
            }
        }


        if(jsonObj.defaultDateString != undefined)
        {
            var defaultDate = new TimelineDate(jsonObj.defaultDateString).date;
            this.SetCurrentYear(defaultDate);
        }

        if(jsonObj.defaultScale != undefined)
        {
            this.setCurrentScale(jsonObj.defaultScale);
        }

        this.refresh();
    }

    /**
     * 
     * @param {Object} jsonEventObj 
     * @param {PersonData} personData 
     * @param {string} category 
     * @param {TimelineColumnWidget} columnWidget 
     * @param {string} colorString 
     * @param {string} colorBString 
     * @param {number} eventIndex 
     * @param {number} columnIndex 
     * @returns {TimelineEvent} the created event
     */
    CreateBubble(jsonEventObj, personData, category, columnWidget, colorString, colorBString, eventIndex, columnIndex)
    {
        var eventDate, eventEndDate, eventBirthDate, eventDeathDate, eventType;

        if(jsonEventObj.dateRange != undefined)
        {
            if(jsonEventObj.dateString!= undefined)
            {
                console.warn("Clashing date definitions for event: " + jsonEventObj.title + "; using date range.");
            }
            eventDate = new TimelineDate(jsonEventObj.dateRange[0]).date;
            eventEndDate = new TimelineDate(jsonEventObj.dateRange[1]).date;
        }
        else
        {
            eventDate = new TimelineDate(jsonEventObj.dateString).date ; //convert to numerical (so can sort, among other things) 
            // TODO keep  these as TimelineDate objects
        
            eventEndDate = new TimelineDate(jsonEventObj.endDateString).date;
        }

        if(eventEndDate==undefined)
        {
            eventEndDate = eventDate;
        }
        
        //TODO Get birth/death dates from personData if available (clean up)
        eventBirthDate = new TimelineDate(jsonEventObj.birthDateString).date; //sets birth and death to undefined if not known
        eventDeathDate = new TimelineDate(jsonEventObj.deathDateString).date;
        
        // new: use date range for more concise data
        if(jsonEventObj.dates != undefined) //TODO this does the same thing as dateRange; consolidate or remove
        {
            if(jsonEventObj.dateString!= undefined)
            {
                console.warn("Clashing date definitions for event: " + jsonEventObj.title + "; using date range.");
            }

            //get the dates from the array of strings
            eventDate = new TimelineDate(jsonEventObj.dates[0]).date;
            eventEndDate = new TimelineDate(jsonEventObj.dates[1]).date;
        }


        if(jsonEventObj.type == undefined)
        {
            eventType = "basic";
        }
        else
        {
            eventType = jsonEventObj.type;
        }



        //var eventIndex = i;
    
        var newEventDomElement = document.createElement("div");
        newEventDomElement.setAttribute("class", "eventBubble");
        newEventDomElement.setAttribute("startDate", eventDate);
        newEventDomElement.setAttribute("selected", false);
        newEventDomElement.setAttribute("eventIndex", eventIndex);
        newEventDomElement.setAttribute("eventType", eventType);
        newEventDomElement.setAttribute("category", category);

        newEventDomElement.setAttribute("oldStyle", (eventType=="person" && personData==undefined) );

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

        //DEBUG
        // if(currentColumn!=0 && currentColumn!=1 && currentColumn!=2)
        // {
        //     console.log(jsonEventObj.title + ": current Column = " + currentColumn);
        // }

        //*** 
        // TODO:  Just pass the jsonEventObj to the constructor and handle everything there; save a reference to the JSON obj
        // inside the TimelineEvent
        //  */
        var newEvent = new TimelineEvent(jsonEventObj,
            jsonEventObj.title, eventDate, eventEndDate, eventBirthDate, eventDeathDate,
            jsonEventObj.searchstring, eventType, jsonEventObj.minScale, jsonEventObj.maxScale,
            newEventDomElement, lifelineDomElement, columnWidget, columnIndex);
            
        let tlIndex = this.timelineIndex;
        newEventDomElement.addEventListener("click", 
            function() { onEventClick(tlIndex, this.getAttribute("eventIndex"), this.getAttribute("startDate")); });
        newEventDomElement.addEventListener("mouseover", 
            function() { onEventMouseOver(tlIndex, this.getAttribute("eventIndex")); });
        newEventDomElement.addEventListener("mouseout", 
            function() { onEventMouseOut(tlIndex, this.getAttribute("eventIndex")); });

        //set background colour
        if(colorString != undefined)
        {
            if(eventType=="basic" || eventType=="era")
            {
                newEventDomElement.style.backgroundColor = colorString;
            }
        }
        if(colorBString != undefined)
        {
            if(eventType=="era")
            {
                newEventDomElement.style.backgroundColor = colorBString;
            }
        }
        
        //save a reference
        this.tlEvents.push(newEvent);

        //check for correct index
        if(this.tlEvents.length != eventIndex + 1)
        {
            throw new Error("Event list indexing problem 1.");
        } 
        
        if(this.tlEvents[eventIndex] != newEvent)
        {
            throw new Error("Event list indexing problem 2.");
        }

        // add to the document
        this.tableDom.appendChild(newEventDomElement);

        return newEvent; //return a reference to the event that was created
    }

    AddEventToList(newEvent)
    {

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

        this.eventStacks = [[],[],[]]; //TODO allow dynamic number of columns
    
        let scalefactor = 1.0/this.currentScale;
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

            //check if tag is disabled
            let tagEnabled = _tlevent.columnWidget.isEnabled;

            // visible if both are true
            let isVisible = withinVisibleScale && tagEnabled;
        
            setVisibility(_tlevent.domElement, isVisible);
           // setVisibility(tlEvents[i].domElement, false);
    
    
            let c = _tlevent.preferredColumn;
            if(c!=0 && c!=1 && c!=2)
            {
                //DEBUG
                console.log(_tlevent.title + ": current Column = " + c);
                //TODO check column is a valid with current number of columns
            }
            //2. determine offset from current year    
            let offset = (_tlevent.date - this.currentYear) * scalefactor + 0.5;
            let topPosition = offset;
            
            if(_tlevent.type==undefined)
            {
                throw new Error("Undefined event type for " + _tlevent.title);
            }
            //default event type
            if(_tlevent.type=="basic")
            {
                //track the event/year stacks
                //TODO stacks should be a whole separate DOM element
                if(this.eventStacks[c][_tlevent.date] == undefined)
                {
                    this.eventStacks[c][_tlevent.date] = []; //each stack is an array of events; there is a separate stack for each date
                }
                this.eventStacks[c][_tlevent.date].push(_tlevent);
             
                let stackheight = this.eventStacks[c][_tlevent.date].length - 1;
                const stackOffsetSpacing = 0.03;
                let stackOffset = stackheight * stackOffsetSpacing; 

                topPosition = offset + stackOffset ; //not currently using stacks for persons or other non-basic events          
                //console.log("offset: " + offset);
            }
            else if(_tlevent.type=="person")
            {
                //use birth and death dates if available
                //otherwise use event date for birth, PRESENTDAY for death
                var lifelineStart = (_tlevent.birthDate==undefined)? _tlevent.date : _tlevent.birthDate;
                var lifelineEnd = (_tlevent.deathDate==undefined)? TimelineDate.PresentDay() : _tlevent.deathDate;

                //set lifline positions - separate from main bubble
                offset = (lifelineStart - this.currentYear) * scalefactor + 0.5;
                setTopPosition(_tlevent.lifelineDomElement, offset);
    
                offset = (lifelineEnd - this.currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.lifelineDomElement, offset);

            }
    
            else if(_tlevent.type=="era")
            {
                //set bottom position by end date
                offset = (_tlevent.endDate - this.currentYear) * scalefactor + 0.5;
                setBottomPosition(_tlevent.domElement, offset);

            }
            else if(_tlevent.type=="horizline")
            {
                topPosition = offset; //as with default
            }

            
            setTopPosition(_tlevent.domElement, topPosition);
            //position in preferred column
            this.positionInColumn(_tlevent, _tlevent.preferredColumn);
        }
    
        
        this.currentYearLabelDom.textContent = TimelineDate.dateString(this.currentYear); //refresh the year labels
        this.minYearLabelDom.textContent = TimelineDate.dateString(this.currentMin); 
        this.maxYearLabelDom.textContent = TimelineDate.dateString(this.currentMax); 
        //TODO other labels
    }

    /**
     * 
     * @param {TimelineEvent} _tlevent 
     * @param {number} columnNumber 
     */
    positionInColumn(_tlevent, columnNumber)
    {
        // if(_tlevent.columnWidget.groupName=="America (US)")
        // {
        //     _tlevent.domElement.style.width = '200px'; //DEBUG
        // }
        if(columnNumber > this.getNumColumns()-1)
        {
            this.positionInColumn(_tlevent, 0);
        }
        else
        {
            var width = (100.0 / this.getNumColumns()); // as a %

            const columnspacing = 0.1; //10% of table width
            //derived
            const widthfactor = 1-columnspacing;
            let columnOffset = columnNumber;

            var leftOffset = 0.4;
            if(_tlevent.type=="era")
            {
                leftOffset = columnspacing*0.5; //to center the events; use 0 to left align
            //   setWidth(_tlevent.domElement, width);
                _tlevent.domElement.style.width = (width * widthfactor) + "%"; //use 90% for a bit of spacing

            }
            else if(_tlevent.type=="horizline")
            {
                leftOffset = 0; 
                //make this disregard the column (always put in left)
                columnOffset = 0;
                _tlevent.domElement.style.width = "100%";

            }
            else if(_tlevent.type=="person")
            {
                leftOffset = 1.2; //to center the events; use 0 to left align

                // set lifeline column
                _tlevent.lifelineDomElement.style.left = ((columnNumber + leftOffset)*width) + "%";
            }

            let leftValue = (columnOffset + leftOffset)*width;
            _tlevent.domElement.style.left = leftValue + "%";

            if(leftValue > 100)
            {
                //DEBUG
                console.log("Setting " + _tlevent.title + " left to " + leftValue);
            }

            //console.log("Set column width to " + width);
        }
    }

    /**
     * 
     * @param {TimelineEvent} _tlevent 
     * @param {number} newColumn 
     */
    changeColumn(_tlevent, newColumn)
    {
        _tlevent.preferredColumn = newColumn;
    }

    /**
     * 
     * @param {string} category 
     * @param {number} newColumn 
     */
    moveCategoryColumn(category, newColumn)
    {
        //TODO need a better way of uniquely assigning category (e.g. a Category link in the tlEvent)
               
        //for now, loop through all events and pick the ones matching the category string
        for(let i=0; i<this.tlEvents.length; i++)
        {
            let _tlevent = this.tlEvents[i];
            if(_tlevent.columnWidget.groupName==category)
            {
                this.changeColumn(_tlevent, newColumn);
            }
        }

        //call this to update all positions
        this.refresh();
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


    /**
     * Assigns the column header DOM elements to this Timeline
     * 
     * @param {string []} headerIDs array of strings that are id values corresponding to the HTML elements of the column headers
     */
    SetHeaders(headerIDs)
    {
        this.columnHeaderDOM = [];

        for(let i=0; i<headerIDs.length; i++)
        {
          this.columnHeaderDOM[i] = document.getElementById(headerIDs[i]);
          makeDraggableTarget(this.columnHeaderDOM[i]);  
        }
    }

}  


// Handle timeline animation
var animTargetDate;
var animProgress;
var animID=null;

/**
 * @type {Timeline}
 */
var animTimeline;

function AnimateMove()
{
    animProgress += ANIMATION_INTERVAL/ANIMATION_TIME;
    if (animProgress < 1.0) {
        //lerp between old date and new date...
        var newYear = TimelineHelper.Lerp(animTimeline.oldCurrentYear, animTargetDate, animProgress);
        animTimeline.SetCurrentYear(newYear);
    }
    else
    {
        // end 

        animTimeline.SetCurrentYear(animTargetDate);
        animTimeline.oldCurrentYear = animTargetDate;
        StopCurrentAnimation();
    }
}

//TODO maybe if this gets called before the last animation has cleared, there will be multiple intervals running
// need to track and clear all intervals properly
function ZoomToDate(date, timelineIndex)
{
    var targetTimeline = getTimeline(timelineIndex);
    animTimeline = targetTimeline;
    animTargetDate = Number(date);
    animProgress = 0.0;

    //cancel any existing animation
    if(animID!=null)
    {
        StopCurrentAnimation();
    }

    //start new animation
    animID = setInterval(AnimateMove, ANIMATION_INTERVAL);
}

function StopCurrentAnimation()
{    
    if(animID==null)
    {
        throw new Error("No animation current; stop animation called incorrectly.")
    }
    clearInterval(animID);
    animID=null;
}



/**
 * This is the main class for objects (tlEvents) that appear on the Timeline including events,
 * eras, persons, wars, etc.
 */
class TimelineEvent {

    /**
     * @type {PersonData}
     */
    personData;


    /**
     * TODO this should replace some of the data passed to the constructor
     * @type {Object}
     */
    jsonEventObj;

    /**
     * 
     * @param {Object} jsonObj 
     * @param {string} title //TODO deprecate these and just use the jsonEventObj
     * @param {number} bubbleDate 
     * @param {number} endDate 
     * @param {number} birthDate 
     * @param {number} deathDate 
     * @param {string} searchstring 
     * @param {string} type 
     * @param {number} minScale this is a lower bound (inclusive) - event should be visible at this scale and above (if less than maxScale)
     * @param {number} maxScale this is an upper bound (not inclusive) - event will NOT be visible at this scale or above
     * @param {HTMLDivElement} domElement 
     * @param {HTMLDivElement} lifelineDomElement 
     * @param {TimelineColumnWidget} columnWidget 
     * @param {number} preferredColumn 
     */
    constructor(jsonObj, title, bubbleDate, endDate, birthDate, deathDate, searchstring, type, minScale, maxScale,
         domElement, lifelineDomElement, columnWidget, preferredColumn=0)
    {
        this.constructor_common(jsonObj, bubbleDate, searchstring, minScale, maxScale,
         domElement, lifelineDomElement, columnWidget, preferredColumn);

        this.title = title;
        this.endDate = Number(endDate);
        this.birthDate = birthDate; //TODO needs to be deprecated
        this.deathDate = deathDate; //TODO needs to be deprecated
        this.type = type;
    }

    //person constructor
    /**
     * 
     * @param {Object} jsonObj 
     * @param {PersonData} personData 
     * @param {number} bubbleDate //TODO replace dates with TimelineDate
     * @param {string} searchstring 
     * @param {number} minScale 
     * @param {number} maxScale 
     * @param {HTMLElement} domElement 
     * @param {HTMLElement} lifelineDomElement 
     * @param {TimelineColumnWidget} columnWidget 
     * @param {number} preferredColumn 
     */
    constructor_person(jsonObj, personData, bubbleDate, searchstring, minScale, maxScale,
         domElement, lifelineDomElement, columnWidget, preferredColumn=0)
    {
        //check if currently used...not currently used
        return; 

        this.title = personData.name;
        this.type = "person";

        this.constructor_common(jsonObj, bubbleDate, searchstring, minScale, maxScale,
         domElement, lifelineDomElement, columnWidget, preferredColumn);

    
    }

    constructor_common(jsonObj, bubbleDate, searchstring, minScale, maxScale,
         domElement, lifelineDomElement, columnWidget, preferredColumn=0)
    {
        this.jsonEventObj = jsonObj;
        this.date = Number(bubbleDate);
        this.searchstring = searchstring;
        
        this.domElement = domElement; //html element
        this.lifelineDomElement = lifelineDomElement; //html element

        this.minScale = minScale;
        this.maxScale = maxScale;

        //other fields
        this.selected=false;
        this.columnWidget=columnWidget;
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
    .textContent = "Testing";
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

    //load the persons database
    console.log("Loading person database");
    PersonDatabase.LoadFromFile(PERSON_DATABASE_FILE);


}

function createAllSelectorOptions(jsonObj)
{    
  //  var selectorDOM = document.getElementById("timelineSelect");
  //  var selectorDOM_second = document.getElementById("timelineSelect2");
 //   createSelectorOptions(jsonObj, selectorDOM, 0);
 //  createSelectorOptions(jsonObj, selectorDOM_second, 1); //TODO clean this up - need 1 selector per column; 


    //  TODO get each timeline index from selector attribute
    //  TODO add isLoaded attribute to grey out options that are already loaded

  /*  let column=2; let tlIndex=0;
    var selectorA = new TimelineSelector(
        tlIndex,
        column,
        jsonObj); //TODO make this a mimber of the Timeline object

    column=2; 
    tlIndex=1;
    var selectorB = new TimelineSelector(
        tlIndex,
        column,
        jsonObj); //TODO make this a mimber of the Timeline object
*/
    mainTimeline.AddSelectorOptions(jsonObj);
    secondTimeline.AddSelectorOptions(jsonObj);

    
    //load default timeline (1st in list)
    mainTimeline.availableColumns = [0]; //set to load in left column
    loadTimeline(jsonObj.timelinelist[0].filename, mainTimeline); 
}


class TimelineSelector 
{
    /**
     * @type {number}
     */
    timelineIndex;
    /**
     * @type {number}
     */
    columnNumber;
    /**
     * @type {JSON}
     */
    jsonObj;

    // hierarchy:
    // container -> {button, selector}
    // selector -> picker
    // picker -> [options]

    /**
     * @type {HTMLElement}
     */
    containerDOM=null;   
    /**
     * @type {HTMLElement}
     */
    buttonDOM=null;    
    /**
     * @type {HTMLElement}
     */
    selectorDOM=null;    
    /**
     * @type {HTMLElement}
     */
    pickerDOM=null;

    /**
     * 
     * @param {number} timelineIndex 
     * @param {number} column 
     */
    constructor(timelineIndex, column)
    {
        this.timelineIndex = timelineIndex;
        this.columnNumber = column;
        this.CreateSelectorDOM();
        this.HidePicker();

        // find the correct parent element in the DOM
        let parentElement = all_timelines[timelineIndex].columnHeaderDOM[column];
        parentElement.appendChild(this.containerDOM);
    }

    CreateSelectorDOM()
    {
           /*                 
           <div class="selectContainer" onclick="showSelector(this)" onmouseleave="hideSelector(this)">
                <div class="plusButton">+</div>
                <div class="tlDropDown" id="timelineSelect" name="timelineSelect"
                targetTimeline=0 onchange="timelineSelectorChanged(0, this.value)"
                style="display: none;">
                     <!-- options to be added by script -->
                </div> 
            </div>
            */

        this.containerDOM = document.createElement("div");
        this.containerDOM.setAttribute("class", "selectContainer");
        this.containerDOM.setAttribute("onclick", "showSelector(this)");
        this.containerDOM.setAttribute("onmouseleave", "hideSelector(this)");

        this.buttonDOM = document.createElement("div");
        this.buttonDOM.setAttribute("class", "plusButton");
        this.buttonDOM.appendChild(document.createTextNode("+")); //just put a + symbol on the button for now
        this.containerDOM .appendChild(this.buttonDOM);

        this.selectorDOM = document.createElement("div");
        this.selectorDOM.setAttribute("class", "tlDropDown");
        this.selectorDOM.setAttribute("id", "timelineSelect");
        this.containerDOM.appendChild(this.selectorDOM);

        //make draggable target so that highlight works correctly
        makeDraggableTarget(this.containerDOM);

    }

    /**
     * 
     * @param {JSON} jsonObj 
     */
    CreateOptions(jsonObj)
    {  
        
        this.jsonObj = jsonObj;


         //clear existing options
        this.selectorDOM.innerHTML=""; //TODO is there a better way to do this?

        //create the picker
        this.pickerDOM = document.createElement("div");
        this.pickerDOM.setAttribute("class", "tlDropdownPicker"); 
        this.selectorDOM.appendChild(this.pickerDOM);

        
        // create the options
        for(let i=0; i<this.jsonObj.timelinelist.length; i++)
        {        
            var newSelectorOption = document.createElement("div");
            newSelectorOption.setAttribute("jsonfile", this.jsonObj.timelinelist[i].filename);      //set the value as filename so we can use it when selecting
            newSelectorOption.setAttribute("timelineIndex", this.timelineIndex);      //set the value as filename so we can use it when selecting
            newSelectorOption.setAttribute("columnIndex", this.columnNumber);
            newSelectorOption.setAttribute("class", "tlDropdownOption"); 
            newSelectorOption.appendChild(document.createTextNode(this.jsonObj.timelinelist[i].title));


            //add the on click action
        //   newSelectorOption.setAttribute("onclick", "timelineSelectorChanged(0,this.attributes.jsonfile.value)"); //another ay to do it
            newSelectorOption.setAttribute("onclick", 
                "timelineSelectorChanged(this.getAttribute('timelineIndex'), this.getAttribute('columnIndex'),\
                this.getAttribute('jsonfile'))");

            //add to the menu
            this.pickerDOM.appendChild(newSelectorOption);
        }
    }


    //maybe not used...
    ShowPicker()
    {
        setVisibility(this.selectorDOM, true);
    }

    HidePicker()
    {
        setVisibility(this.selectorDOM, false);

    }
}


/**
 * 
 * @param {HTMLElement} containerDOM 
 */
function showSelector(containerDOM)
{
    var plusbuttonDOM = containerDOM.querySelector('.plusButton') 
    var selectorDOM = containerDOM.querySelector('.tlDropDown');  
   // setVisibility(plusbuttonDOM, false);
    setVisibility(selectorDOM, true);
 //   selectorDOM.showPicker(); //open the menu: may not be supported by browser
}
function hideSelector(containerDOM)
{
    var plusbuttonDOM = containerDOM.querySelector('.plusButton') 
    var selectorDOM = containerDOM.querySelector('.tlDropDown');  
    setVisibility(selectorDOM, false);
   // setVisibility(plusbuttonDOM, true);
}
    
    
/**
 * DEPRECATED
 * @param {JSON} jsonObj 
 * @param {HTMLElement} selectorDOM 
 * @param {number} timelineIndex 
 */
function createSelectorOptions(jsonObj, selectorDOM, timelineIndex)
{    

    console.log("FUNCTION DEPRECATED: createSelectorOptions");

    //clear existing options
    selectorDOM.innerHTML="";

   //create the picker
    var newSelectorPicker = document.createElement("div");
    newSelectorPicker.setAttribute("class", "tlDropdownPicker"); 
    selectorDOM.appendChild(newSelectorPicker);

    

    for(let i=0; i<jsonObj.timelinelist.length; i++)
    {        
        //var newSelectorOption = document.createElement("option");
        //newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].filename);      //set the value as filename so we can use it when selecting

        var newSelectorOption = document.createElement("div");
        newSelectorOption.setAttribute("jsonfile", jsonObj.timelinelist[i].filename);      //set the value as filename so we can use it when selecting
        newSelectorOption.setAttribute("timelineIndex", timelineIndex);      //set the value as filename so we can use it when selecting
        newSelectorOption.setAttribute("class", "tlDropdownOption"); 
        //newSelectorOption.setAttribute("value", jsonObj.timelinelist[i].title);
        newSelectorOption.appendChild(document.createTextNode(jsonObj.timelinelist[i].title));


        //add the on click action
     //   newSelectorOption.setAttribute("onclick", "timelineSelectorChanged(0,this.attributes.jsonfile.value)"); //another ay to do it
        newSelectorOption.setAttribute("onclick", "timelineSelectorChanged(this.getAttribute('timelineIndex'), this.getAttribute('jsonfile'))");

        //add to the menu
        newSelectorPicker.appendChild(newSelectorOption);
    }

}

function formatSelectorChanged(timelineIndex, value)
{    
    var targetTimeline = all_timelines[Number(timelineIndex)];

    TimelineDate.currentDateFormat = value;
    targetTimeline.refresh();
    updateYearInput();
    UpdateInfoPanel();
    RefreshPersonPanel();
    

}

/**
 * 
 * Handler for when the drop down selects a new timeline (category) to load
 * @param {string} timelineIndexStr attribute from HTML element; needs cast to number
 * @param {string} columnIndexStr attribute from HTML element; needs cast to number
 * @param {string} timelineFile 
 */
function timelineSelectorChanged(timelineIndexStr, columnIndexStr, timelineFile)
{    

   var targetTimeline = all_timelines[Number(timelineIndexStr)];
   targetTimeline.availableColumns = [Number(columnIndexStr)];     //passing in from attribute may end up as a string

    loadTimeline(timelineFile, targetTimeline);

    //TODO disable the selector option just loaded, re-enable it if the category is unloaded
    //Maybe just remove the existing selector and have it part of the Timeline (in the headers)
}

// update the value of the HTML year field
function updateYearInput()
{
    var yearInputDOM = document.getElementById("yearInput");
  //  yearInputDOM.value = dateString(mainTimeline.currentYear);

    yearInputDOM.value = TimelineDate.dateString(mainTimeline.currentYear);
    // TODO print out gregorian equivalent underneath

    updateGregorianLabel();
}

//update the current year FROM the HTML field
function submitYearInput()
{
    var yearInputDOM = document.getElementById("yearInput");
    mainTimeline.SetCurrentYear(new TimelineDate(yearInputDOM.value).date);
}

// update the value of the HTML year field
function updateScaleInput()
{
    var dom = document.getElementById("scaleInput");

   /*var formatOptions = {
        notation: "standard"
    };

    if(Math.abs(mainTimeline.currentScale) > 10000)
    {
        //formatOptions.notation = "scientific";
        formatOptions.notation = "compact";
    }

   // const formattedNumberEN = new Intl.NumberFormat('fr-FR').format(mainTimeline.currentScale);
    const formattedNumberEN = new Intl.NumberFormat('en-US', formatOptions).format(mainTimeline.currentScale);

    dom.value = formattedNumberEN;
    */
    dom.value = TimelineDate.timespanString(mainTimeline.currentScale);
}

//update the current year FROM the HTML field
function submitScaleInput()
{
    var dom = document.getElementById("scaleInput");
    mainTimeline.setCurrentScale(dom.value); //TODO need to parse according to current year format
}

function updateGregorianLabel()
{    
    var dom = document.getElementById("yearLabelGregorian");
    //dom.innerText = "(" + TimelineDate.dateStringClassic(mainTimeline.currentYear) + ")";
    dom.innerText = "(" + TimelineDate.dateStringNew(mainTimeline.currentYear, tlSystem_CE) + ")"; //use the more scientific CE label for now
}

function initTimelines()
{
    //init variables
    document.getElementById("formatSelect").value = "gregorian";

    mainTimeline = new Timeline(
        document.getElementById("mainTable"),
        ["colHeader1", "colHeader2", "colHeader3"], 0);
    secondTimeline = new Timeline(
        document.getElementById("secondTable"),
        ["colHeader5", "colHeader6", "colHeader7"], 1);



   // mainTimeline.SetHeaders(["colHeader1", "colHeader2", "colHeader3"]);
   // secondTimeline.SetHeaders(["colHeader5", "colHeader6", "colHeader7"]);

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
    //first, check if this data is already loaded
    if(targetTimeline.tlCategories[jsonObj.category]!=undefined)
    {
        console.log("Category " + jsonObj.category + "already exists in this Timeline; loading cancelled.");
        return;
    }



    //load events from this JSON file
    targetTimeline.CreateEventBubbles(jsonObj, false);
    
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

const TLDateFormat = Object.freeze({
    CLASSIC: "classic", //the old system
    CLASSIC_HOL: "classic_holocene", //the old holocene
    GREG: "gregorian",
    CE: "ce",
    MA: "megaannum",
    HOL: "holocene",
    MIDRTH: "middleearth"
});


class TimelineDateEra
{
    name;

    // start and end years are inclusive
    startYear; //using the internal standard format
    endYear;
    
    //notation
    prefixString;
    suffixString;
    fractionDigits; //0 for AD/BC, 2 for MegaAnnum etc.

    conversionScaling; //scale factor for converting years, usually 1 or -1
    conversionOffset; //

    get length()
    {
        return this.endYear - this.startYear;
    }

    constructor(eraData)
    { 
        Object.assign(this, eraData);

        if(this.startYear > this.endYear)
        {
            console.error("Bad Era definition: " + this.name + ". Start year should be before end year.");
        }
    }

    containsYear(dateRounded){
        if(this.startYear==undefined && this.endYear==undefined)
        {
            return true; //no bounds on this era
        }
        else if(this.startYear==undefined)
        {
            return dateRounded <= this.endYear;
        }
        else if(this.endYear==undefined)
        {
            return dateRounded >= this.startYear;
        }
        else {
            return this.startYear <= dateRounded && this.endYear >= dateRounded;
        }
    }

    /**
     * 
     * @param {number} dateRounded the year in standard format 
     * @returns the converted year in this Era's formatting
     */
    convertYear(dateRounded)
    {
        return (dateRounded * this.conversionScaling) + this.conversionOffset;
    }

    dateToString(dateRounded)
    {
        //check yearNumber is within range
        if(!this.containsYear(dateRounded))
        {
            console.warn("Year out of bounds.");
            return "Unknown year";
        }

        let yearOutput = this.convertYear(dateRounded);
        
        //return the string e.g. "55 BBY"
        let str = String(yearOutput);
        if(this.prefixString!=undefined) str = this.prefixString + str;
        if(this.suffixString!=undefined) str = str + this.suffixString;
        return str;
    }
}



class TimelineDateSystem
{
    /**
     * @type {TimelineDateEra[]}
     */
    erasList; //array of time ranges (TimelineDateEra) in chronological sequence

    
    constructor(erasData)
    {
        Object.assign(this, erasData);

        //tODO - check things here (overlapping eras, etc.)
    }

    dateToString(dateRounded)
    {
        // first determine the correct era
        let thisEra = null;
        for(let i=0; i<this.erasList.length; i++)
        {
            if(this.erasList[i].containsYear(dateRounded))
            {
                thisEra = this.erasList[i];
                break;
            }
        }

        return thisEra.dateToString(dateRounded);

    }

    stringToDate(dateString)
    {

    }

}

const tlEra_BC = new TimelineDateEra(
{
    name: "BC Era", 
    startYear: undefined,
    endYear: -1, //i.e. 1 BC
    conversionScaling: -1,
    conversionOffset: 0, //internal date format uses -1 for 1BC and 1 for 1AD, skipping 0
    prefixString: "",
    suffixString: " BC"
});

const tlEra_AD = new TimelineDateEra(
{
    name: "AD Era", 
    startYear: 1,
    endYear: 999,
    conversionScaling: 1,
    conversionOffset: 0,
    prefixString: "AD ",
});

const tlEra_AD_post1000 = new TimelineDateEra(
{
    name: "Post 1000 AD Era", 
    startYear: 1000,
    endYear: undefined,
    conversionScaling: 1,
    conversionOffset: 0
    //no prefix/suffix
});


const tlEra_BCE = new TimelineDateEra(
{
    name: "BCE Era", 
    endYear: -1, //i.e. 1 BC
    conversionScaling: -1,
    conversionOffset: 0, //internal date format uses -1 for 1BC and 1 for 1AD, skipping 0
    suffixString: " BCE"
});

const tlEra_CE = new TimelineDateEra(
{
    name: "CE Era", 
    startYear: 1,
    conversionScaling: 1,
    conversionOffset: 0,
    suffixString: " CE"
});


const tlEra_HOL_negative = new TimelineDateEra(
{
    name: "Holocene negative", 
    endYear: -1, //i.e. 1 BC
    conversionScaling: 1,
    conversionOffset: 10001, //so for 1BC ==> -1*1 + 10001 = 10000
    suffixString: " HE"
});
const tlEra_HOL_positive = new TimelineDateEra(
{
    name: "Holocene positive", 
    startYear: 1, //i.e. 1 AD
    conversionScaling: 1,
    conversionOffset: 10000, //so for 1AD ===> 1*1 + 10000 = 10001
    suffixString: " HE"
});

const tlEra_IslamicAH = new TimelineDateEra(
{
    name: "Holocene positive", 
    startYear: 1, //i.e. 1 AD
    conversionScaling: 1,
    conversionOffset: 10000, //so for 1AD ===> 1*1 + 10000 = 10001
    suffixString: " HE"
});

const tlSystem_GREG = new TimelineDateSystem(
    {
        erasList: [tlEra_BC, tlEra_AD, tlEra_AD_post1000]
    }
);
const tlSystem_CE = new TimelineDateSystem(
    {
        erasList: [tlEra_BCE, tlEra_CE]
    }
);
const tlSystem_HOL = new TimelineDateSystem(
    {
        erasList: [tlEra_HOL_negative, tlEra_HOL_positive]
    }
);


/* FICTIONAL: */
//Tolkien. Src: https://tolkiengateway.net/wiki/Timeline

const tlEra_Tolkien_VY = new TimelineDateEra(
{
    name: "Valian Years", 
    startYear: 1, //i.e. 1 HE
    endYear: 35000, //i.e. 1 HE
    conversionScaling: 0.1,
    conversionOffset: 0, //so for 1VY ===> 1*10 
    suffixString: " V.Y."
});
const tlEra_Tolkien_YT = new TimelineDateEra(
{
    name: "Years of the Trees", 
    startYear: 35001,
    endYear: 3501,
    conversionScaling: 1,
    conversionOffset: 10000, //so for 1AD ===> 1*1 + 10000 = 10001, as with holocene
    suffixString: " Y.T."
});
const tlEra_Tolkien_FA = new TimelineDateEra(
{
    name: "First Age", //First Age years after the Sun rises (in YT 1500)
    startYear: 1,
    endYear: 590,
    conversionScaling: 1,
    conversionOffset: 0, //so for 1AD ===> 1*1 + 10000 = 10001, as with holocene
    suffixString: " F.A."
});
const tlEra_Tolkien_SA = new TimelineDateEra(
{
    name: "Second Age", //First Age years after the Sun rises (in YT 1500)
    startYear: 591,
    endYear: 4031,  //3441 F.A.
    conversionScaling: 1,
    conversionOffset: 0, //so for 1AD ===> 1*1 + 10000 = 10001, as with holocene
    suffixString: " S.A."
});
const tlEra_Tolkien_TA = new TimelineDateEra(
{
    name: "Third Age", //First Age years after the Sun rises (in YT 1500)
    startYear: 4032,
    endYear: 7052,  //3021 T.A.
    conversionScaling: 1,
    conversionOffset: 0, //so for 1AD ===> 1*1 + 10000 = 10001, as with holocene
    suffixString: " T.A."
});
const tlEra_Tolkien_FoA = new TimelineDateEra(
{
    name: "Fourth Age", //First Age years after the Sun rises (in YT 1500)
    startYear: 7053,
    endYear: undefined,
    conversionScaling: 1,
    conversionOffset: 0, //so for 1AD ===> 1*1 + 10000 = 10001, as with holocene
    suffixString: " Fo.A."
});

const tlSystem_MIDDLEEARTH = new TimelineDateSystem(
    {
        erasList: [tlEra_Tolkien_FA, tlEra_Tolkien_SA, tlEra_Tolkien_TA, tlEra_Tolkien_FoA]
    }
);


//DATE & STRING FUCNTIONS
//TODO - organize as (static?) methods in a TimelineDate class

class TimelineDate 
{
    dateString;
    /**
     * Internal date representation. Can be fractional (floating point). 
     * Dates are currently represented (internally) in Gregorian format; 
     * use conversion functions to display in correct format
     * @type {number}
     */
    dateNumber;
    dateFormatOriginal;
    isApprox;

 

    /**
     * @type {string}
     */
    static currentDateFormat=TLDateFormat.GREG;
   // static currentDateFormat=TLDateFormat.HOL;

    /**
     * 
     * create date int from string in format "[year]" or "[year] BC"
     * 
     * @param {string} dateString the input string 
     */
    constructor(dateString)
    {
        this.dateString = dateString;

        let obj = TimelineDate.unpackDateString(this.dateString);
        this.dateNumber = obj.dateInt;
        this.isApprox = obj.isApprox;
        this.dateFormatOriginal = obj.dateFormat;
        
    }

    get date() {
        return this.dateNumber;
    }

    /**
     * Generate a new string representation of the date
     * If approx, include this in the string.
     * @returns {string}
     */
    makeString()
    {
        if(this.date == undefined)
        {
            return "unknown date";
        }


        var str = TimelineDate.dateString(this.date);
        if(this.isApprox)
        {
            str = "c. " + str;
        }
        return str;
    }

    /**
     * 
     * @returns {number} the current, real-world year (UTC)
     */
    static PresentDay()
    {        
        const date = new Date();
        const presentYear = date.getUTCFullYear();
        return presentYear;
    }

    /**
     * 
     * @param {number} yearA 
     * @param {number} yearB 
     * @returns the difference in years between two dates, accounting for BC dates as negative numbers. Result is negative if yearB is the lower number.
     */
    static yearDifference(yearA, yearB)
    {        
        if(yearA==undefined || yearB == undefined)
        {
            throw new error("yearDifference: undefined date argument");
        }
        if(yearB < yearA)
        {
            //reverse the inputs & return a negative value
            return - this.yearDifference(yearB, yearA);
        }

        //need to handle AD/BC weirdness e.g. born in -1, current year 1 ==> 1 year old
        if(yearA < 0 && yearB > 0)
        {
            return (yearB - yearA) - 1;
        }
        return yearB - yearA;
    }

    /**
     * 
     * create date int from string in format "[year]" or "[year] BC"
     * 
     * @param {string} dateString the input string 
     * @returns {{dateInt: number | undefined, isApprox: boolean, dateFormat: string}} the year as an integer and whether it is approximate
     */
    static unpackDateString(dateString)
    {

        var isApprox = false;
        var dateInt; //return value
        var dateFormat = TLDateFormat.GREG;

        if(dateString==undefined)
        {
            dateInt = undefined;
        } 
        else if(dateString == "PRESENTDAY")
        {
            dateInt = TimelineDate.PresentDay();
            isApprox = false;
        }
        else
        {        

            /** first, split string by whitespace
             */
        //    var tokens = dateString.split(" ");
            var tokens = dateString.match(/\S+/g); 

            //handle 'approximate' dates
            if(tokens[0].toLowerCase() == "c." || tokens[0].toLowerCase() == "c"|| tokens[0].toLowerCase() == "~")
            {
                //date is approx
                isApprox = true;
                tokens=tokens.slice(1); // remove first element from array and continue.
            }

            var formatStr = "ad";
            if(tokens[1])
            {
                formatStr = tokens[1].toLowerCase();
            }

            // handle non-gregorian formats
            if(formatStr == "ma")
            {
                dateInt = this.dateMAtoGREG(Number(tokens[0])); //use Gregorian format to store internally
                dateFormat = TLDateFormat.MA;                
            }
            else if(formatStr == "he")
            {
                dateInt = this.dateHOLtoGREG(Number(tokens[0])); //use Gregorian format to store internally
                dateFormat = TLDateFormat.HOL;                
            }
            // handle gregorian format
            else if(formatStr == "bc")
            {
                dateInt = Number(tokens[0]) * -1; //TODO this will cause an off by 1 error when calculating date differences; use apporpriate comparison methods
            }
            else
            {
                dateInt = Number(tokens[0]);
            }
        }


        //special case: input is 0
        if(dateInt==0 && dateFormat==TLDateFormat.GREG)
        {
            dateInt = 1;
            console.warn("0 is not a valid year in the Gregorian calendar; rounding to year 1.");
        }

        return {
            dateInt: dateInt, 
            isApprox: isApprox,
            dateFormat: dateFormat
        };
    }


    /**
     * similar to dateString but input is impliet to be a number or range of years rather than a specific date
     * @param {number} numYears 
     * @returns {string} appropriately formatted string
     */
    static timespanString(numYears)
    {
        var outstr = "";
        var formatOptions = {
            notation: "standard"
        };

        if(Math.abs(numYears) > 10000)
        {
            //formatOptions.notation = "scientific";
            formatOptions.notation = "compact";
        }

        var formattedNumberEN = new Intl.NumberFormat('en-US', formatOptions).format(numYears);

        outstr = formattedNumberEN;
        return outstr;
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
    static dateString(dateNumber)
    {
        //if(currentScale > MEGA_ANNUM_THRESHOLD)
        if(Math.abs(Number(dateNumber)) > MEGA_ANNUM_THRESHOLD)
        {
            return TimelineDate.dateStringMegaAnnum(dateNumber);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.CLASSIC)
        {
            return TimelineDate.dateStringClassic(dateNumber);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.CLASSIC_HOL)
        {
            return TimelineDate.dateStringHolocene_Classic(dateNumber);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.GREG)
        {
            return TimelineDate.dateStringNew(dateNumber, tlSystem_GREG);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.CE)
        {
            return TimelineDate.dateStringNew(dateNumber, tlSystem_CE);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.HOL)
        {
            return TimelineDate.dateStringNew(dateNumber, tlSystem_HOL);
        }
        else if(TimelineDate.currentDateFormat==TLDateFormat.MIDRTH)
        {
            return TimelineDate.dateStringNew(dateNumber, tlSystem_MIDDLEEARTH);
        }

        //by default just return the input as a string
        return String(dateNumber);
    }

    /**
     * 
     * create MA date string from number
     * 
     * @param {number} dateNumber the input string 
     */
    static dateStringMegaAnnum(dateNumber)
    {
        var date = Number(dateNumber);
        // var str = (date / MEGA_ANNUM).toFixed(2) + " Ma";
        var options = {
            maximumFractionDigits: 2
        }
        var str = this.dateGREGtoMA(date).toLocaleString("en-GB", options) + " Ma";

        if(date > 0)
        {
            str = "+" + str; //to avoid ambiguity
        }

        return str;
    }

        
    /**
     * 
     * create Gregorian date string from number
     * 
     * Dates round up if AD, down if BC
     * NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
     *    updated: 0 will throw an error
     * All dates in the range (0, 1] count as 1 AD
     * 
     * @param {number} dateNumber the input date as number (expects floating point value) 
     * @returns {string} the 'AD/BC' string of the date (AD omitted if date is later than 999 AD)
     */
    static dateStringClassic(dateNumber)
    {   

        //temp for testing
        //return this.dateStringNew(dateNumber);



        var date = Number(dateNumber);
        var str;
        if(date == 0)
        {
            throw new error("0 is not a valid input to convert to Gregorian year");
        }

        if(date <= 0)
        {
            str = -TimelineDate.dateRound(date)+ " BC (classic)"; //so -0.1, -1 becomes '1 BC'. NB exactly '0' will return '0 BC'; only dates in the range [-1, 0) count as 1 BC
            //str = tlEra_BC.dateToString(TimelineDate.dateRound(date)); 
        }
        else if(date < 1000)
        {
           str = TimelineDate.dateRound(date) + " AD (classic)"; //so 0.1, 0.5, 1 becomes '1 AD'. All dates in the range (0, 1] count as 1 AD
           //str = tlEra_AD.dateToString(TimelineDate.dateRound(date));
        }
        else
        {
           str = TimelineDate.dateRound(date) + " (classic)"; //so 1000 becomes '1000'
           //str = tlEra_AD_post1000.dateToString(TimelineDate.dateRound(date));
        }

        return str;

    }       

    /**
     * 
     * @param {number} dateNumber the input date in internal number (Gregorian) i.e. [-1, 0) is 1 BC; (0, 1] is 1 AD, 0 is undefined
     * @param {TimelineDateSystem} tlDateSystem the date system we want to display the output in
     * @returns {string} the string representation of the input date, in the supplied format
     */
    static dateStringNew(dateNumber, tlDateSystem)
    {      
        var dateRounded = TimelineDate.dateRound(Number(dateNumber));
        var str;
        if(dateRounded == 0)
        {
            //should never happen: dateRound not return 0
            throw new error("0 is not a valid input to convert to Gregorian year");
        }

        str = tlDateSystem.dateToString(dateRounded);

        return str;

    }
    
    //TODO replace with new-style system
    static dateStringHolocene_Classic(dateNumber)
    {
        var date = Number(dateNumber);
        var str = "unknown result"; //this will be the output if there is an error in conversion

        str = String(this.dateGREGtoHOL(date)) + " HE (classic)";

        return str;
    }

    /**
     * Date format conversion - Gregorian to Holocene
     * @param {number} date_num_gregorian 
     * @returns {number}
     */
    static dateGREGtoHOL(date_num_gregorian)
    {
        if(date_num_gregorian==0)
        {
            throw new Error("Zero is invalid gregorian date.");
        }
        
        if(date_num_gregorian >= 0)
        {
            //1 AD (1) becomes 10,001 HE
            return 10000 + TimelineDate.dateRound(date_num_gregorian);
        }
        else
        {
            //1 BC (-1) becomes 10,000 HE
            return 10001 + TimelineDate.dateRound(date_num_gregorian);
        }

    }

    /**
     * Date format conversion - Holocene to Gregorian
     * @param {number} date_num_holocene 
     * @returns {number}
     */
    static dateHOLtoGREG(date_num_holocene)
    {
        // ==== AD ===
        //10001 --> 1
        //10001.1 --> 1.1
        //10000.9 ---> 0.9

        // === BC ====
        //10000 --> -1
        //9999.9 --> -1.1
        //9999 --> -2
        var dateGreg = date_num_holocene - 10000;
        if(dateGreg <= 0)
        {
            //skip year zero; BC dates start from -1
            dateGreg = dateGreg - 1;
        }
        return dateGreg;
    }

    static dateGREGtoMA(date_num_gregorian)
    {
        return date_num_gregorian/MEGA_ANNUM;
        //TODO standard practice is to use 1950 as the starter for 'before present', might incorporate this in future
    }

    static dateMAtoGREG(date_num_ma)
    {
        return date_num_ma * MEGA_ANNUM;
    }

    /**
     * 
     * @param {number} dateNumber - a year in decimal floating point format
     * @returns whole number date, rounded to correct year for BC/AD
     */
    static dateRound(dateNumber)
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
    throw new Error("dateIntIfDefined: function deprecated");
    if(dateString == undefined)
    {
        return backup;
    }
    else
    {
        return new TimelineDate(dateString).date;
    }
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
function setTopPosition(domElement, heightFactor)

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

/**
 * 
 * @param {HTMLElement} domElement 
 * @param {boolean} isVisible 
 * 
 * turn on or off visibility of specified HTML element
 * 
 */
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
    //temp
    //UpdateInfoPanelWikipedia();
    //UpdateInfoPanelWikipedia2();
    let summaryText=undefined;
    //summaryText = UpdateInfoPanelWikipedia3();
    //summaryText = UpdateInfoPanelWikipedia4();
 //   return;


    var infoPanel = document.getElementById("infoPanel");
    infoPanel.innerHTML = ""; //clears the info Panel - TODO is there a better way?

    if(selectedTimeline!=undefined && selectedTimeline.currentSelectedEvent != undefined)
    {
        var tlEvent = selectedTimeline.currentSelectedEvent;
        //create content for info panel
        var newDiv = document.createElement("div");
        newDiv.setAttribute("id", "infoPanelContent");

        var titleDOM = document.createElement("h2");
      //  titleDOM.innerText = tlEvent.title;

        var dateText = "";
        if(tlEvent.endDate != tlEvent.date)
        {
            dateText = TimelineDate.dateString(tlEvent.date) + " - " + TimelineDate.dateString(tlEvent.endDate);
        }
        else
        {
            dateText = TimelineDate.dateString(tlEvent.date);
        }
     //   addParagraph(newDiv, dateText);
        titleDOM.textContent = tlEvent.title + " (" + dateText + ")";
        newDiv.appendChild(titleDOM);

        if(tlEvent.jsonEventObj.subtitle!=undefined)
        {
            var subtitleDOM = document.createElement("h3");
            subtitleDOM.textContent = tlEvent.jsonEventObj.subtitle;
            newDiv.appendChild(subtitleDOM);
        }
        
        // add a vertical space
        newDiv.appendChild(document.createElement("p"));

        if(tlEvent.type=="person")
        {
            if(tlEvent.personData==undefined)
            {
                /**
                 * OLD STYLE
                 */
                //TODO this should be slowly deprecated - use PersonData instead
                var lifetimetext = "Lived: " + ( (tlEvent.birthDate==undefined)? "unknown date" : TimelineDate.dateString(tlEvent.birthDate) ) 
                + " to " + ((tlEvent.deathDate==undefined)? "unknown date" : TimelineDate.dateString(tlEvent.deathDate));

                if(tlEvent.birthDate!=undefined && tlEvent.deathDate!=undefined)
                {
                    lifetimetext = lifetimetext + " (" + TimelineDate.timespanString(tlEvent.deathDate-tlEvent.birthDate) + " years)"
                }
                lifetimetext = lifetimetext;

                TimelineHelper.AddParagraph(newDiv, lifetimetext);
                TimelineHelper.AddParagraph(newDiv,  "(NB: data is using old-style person info)", true)
            }   
            else
            {
                //TimelineHelper.AddParagraph(newDiv, tlEvent.personData.infoString());
                newDiv.appendChild(tlEvent.personData.infoBlock());
            }
        }

        
        if(summaryText!=undefined)
            { 
                TimelineHelper.AddParagraph(newDiv, summaryText);
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
    personPanel.innerHTML = ""; //clears the  Panel TODO find a better way (make a clearElement function if doesnt exist)
    
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
       
       
      
      
                //newDiv.innerText = aliveListText;

        //document.getElementById("personPanel").appendChild(newDiv);
        //personPanel.innerText = aliveListText;



       //var aliveListHTML = selectedTimeline.personlist.PersonsAliveStringHTML(selectedTimeline.currentYear);
        //personPanel.innerHTML = aliveListHTML;

        personPanel.appendChild(selectedTimeline.personlist.CurrentYearReport(selectedTimeline.currentYear));
        personPanel.appendChild(selectedTimeline.specieslist.CurrentYearReport(selectedTimeline.currentYear));
    }

}


function UpdateInfoPanelWikipedia()
{
    var requestString = "blackbeard";//mainTimeline.currentSelectedEvent.searchstring;
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
  
  //xmlhttp.send("title="+requestString+"&origin='https://www.mediawiki.org'&action=query&format=jsonp");
    
    xmlhttp.send("origin=*&action=opensearch&search=bee&limit=1&format=json");
  
    
//    https://en.wikipedia.org/w/api.php?action=opensearch&search=bee&limit=1&format=json

}

function  UpdateInfoPanelWikipedia2()
{    
    var requestString = "blackbeard";//mainTimeline.currentSelectedEvent.searchstring;
    getWikipediaContent(requestString);
}

function UpdateInfoPanelWikipedia3()
{
    //Code reference from Google AI...

    // Choose the Wikipedia article title you want to display (use underscores for spaces)
    const articleTitle = "Blackbeard"; 

    let summaryText = "Summary not found"

    // Call the Wikipedia REST API for the page summary
    fetch(`https://wikipedia.org{articleTitle}`)
        .then(response => response.json())
        .then(data => {
            // Populate the HTML elements with Wikipedia data
           // document.getElementById("title").innerText = data.title;
          //  document.getElementById("extract").innerText = data.extract;
           // document.getElementById("link").href = data.content_urls.desktop.page;
           summaryText = data.extract;

            // Display the image if one exists
         /*   if (data.thumbnail) {
                const imgElement = document.getElementById("image");
                imgElement.src = data.thumbnail.source;
                imgElement.style.display = "block";
            }*/
        })
        .catch(error => {
            console.error("Error fetching Wikipedia summary:", error);
           // document.getElementById("title").innerText = "Failed to load summary.";
            summaryText = "Failed to load summary.";
        });


     return summaryText;
}

function UpdateInfoPanelWikipedia4()
{
    const articleTitle = "Blackbeard";
    let summaryText = "Summary not found"

    // Using the Action API with origin=* to bypass strict CORS on file://
    const url = `https://wikipedia.org|pageimages&exintro=1&explaintext=1&titles=${articleTitle}&piprop=thumbnail&pithumbsize=200&origin=*`;
   // const url = `https://wikipedia.org|pageimages&exintro=1&explaintext=1&titles=${articleTitle}&piprop=thumbnail&pithumbsize=200&origin=*`;
   // const url = `https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&search=${encodeURIComponent(articleTitle)}&format=json`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (pageId === "-1") {
                summaryText = "Article not found.";
                return summaryText;
                //document.getElementById("title").innerText = "Article not found.";
                //return;
            }

            // Populate the HTML
            //document.getElementById("title").innerText = page.title;
           // document.getElementById("extract").innerText = page.extract;
            //document.getElementById("link").href = `https://wikipedia.org{pageId}`;
            summaryText = page.extract;

            // Display image if available
           /* if (page.thumbnail) {
                const imgElement = document.getElementById("image");
                imgElement.src = page.thumbnail.source;
                imgElement.style.display = "block";
            }*/
        })
        .catch(error => {
            console.error("Error fetching Wikipedia data:", error);
            //document.getElementById("title").innerText = "Error loading summary.";
            summaryText = "Error loading summary.";
        });

        return summaryText;
}

//from google AI example
async function getWikipediaContent(searchTerm) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&explaintext=1&origin=*&search=${encodeURIComponent(searchTerm)}&format=json`;
  //const url = `https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&search=${encodeURIComponent(searchTerm)}&redirects=1&format=json`;
  //const url = 'https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts&exlimit=1&titles=pizza&explaintext=1&exsectionformat=plain';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    // Process the data here, for example:
    // const titles = data[1];
    // const descriptions = data[2];
    // const links = data[3];

    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    let summaryText = page.extract;
    console.log("SUMMARY: " + summaryText);
  } catch (error) {
    console.error("Error fetching Wikipedia content:", error);
  }
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



/**
 * Handle mousewheel scaling
 * @param {WheelEvent} event 
 * @param {number} timelineIndex 
 */
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
    targetTimeline.sliderScale = TimelineHelper.TimelineScaleToSliderScale(targetTimeline.currentScale);
    targetTimeline.sliderScale += y * MWHEEL_SCROLL_FACTOR;
    targetTimeline.setCurrentScale(TimelineHelper.SliderScaleToTimelineScale(targetTimeline.sliderScale));

    
   // console.log("scaling timeline " + timelineIndex + " deltaY=" + y);

}

// ***  Event handlers for drag-and-drop

/**
 * 
 * @param {DragEvent} ev 
 */
function dragstartHandler(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

/**
 * 
 * @param {DragEvent} ev 
 */
function dragoverHandler(ev) {
    ev.preventDefault();

    var targetElement = getDragTargetHeader(ev);
    targetElement.setAttribute("isDragTarget", true); 

}

/**
 * This is a helper function to get the header DOM appropriate to a current drag event
 * @param {DragEvent} ev the drag event
 */
function getDragTargetHeader(ev)
{   
     //need to find the column header to drop into
    var targetElement;
    if(ev.target.getAttribute("class")=="tableColumnHeader")
    {
        targetElement = ev.target;
    }
    else// if(ev.target.getAttribute("class")=="tlColumnWidget")
    {
        targetElement = ev.target.parentNode;
    }

    return targetElement;
}
/**
 * This is a helper function to set up the behaviour of a drag target
 */
function makeDraggableTarget(domElement)
{
    //other widgets may be dragged onto this, need to define this behaviour
    domElement.setAttribute("ondragenter", "dragenterHandler(event)");
    domElement.setAttribute("ondragleave", "dragleaveHandler(event)");
    domElement.setAttribute("ondragover", "dragoverHandler(event)");

    //TODO set this up for the selector widgets too.
}
/**
 * 
 * @param {DragEvent} ev 
 */
function dragenterHandler(ev)
{
    ev.preventDefault();
    dragOverCounter++;
    //setDebugText("drag over counter: " + dragOverCounter);

}

/**
 * 
 * @param {DragEvent} ev 
 */
function dragleaveHandler(ev)
{
    ev.preventDefault();
    dragOverCounter--;
    //setDebugText("drag over counter: " + dragOverCounter);

    //need to find the column header to drop into
    var targetElement = getDragTargetHeader(ev); //this is the header node

    if(dragOverCounter<=1)
    {
        targetElement.setAttribute("isDragTarget", false);
        ev.target.setAttribute("isDragTarget", false);
    }
}

/**
 * 
 * @param {DragEvent} ev 
 * @param {number} columnID 
 * @param {number} timelineIndex 
 */
function dropHandler(ev, columnID, timelineIndex) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    let widgetElement = document.getElementById(data);

    //need to find the column header to drop into
    var targetElement = getDragTargetHeader(ev);

    //add the widget to the new header
    targetElement.appendChild(widgetElement); 

    //move all the events into the new column
    let categoryString = widgetElement.getAttribute("category");
    all_timelines[timelineIndex].moveCategoryColumn(categoryString, columnID);
    //TODO nb need to handle moving from one timeline to another...
    // 1. unload events from this timeline
    // 2. load events in new timeline
    // 3. allow to shortcut this by copying the events over without unloading/realoading
    //......

    //undo the highlight    
    
    dragOverCounter=0;
    //setDebugText("drag over counter: " + dragOverCounter);
    targetElement.setAttribute("isDragTarget", false);
}







// *** Functions that handle timeline dragging
var isDragging = false;
var mouseDownY;

/**
 * 
 * @param {MouseEvent} event 
 * @param {number} timelineIndex 
 * @returns 
 */
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

    //cancel any existing animation
    if(animID!=null)
    {
        StopCurrentAnimation();
    }

    //begin drag  
    isDragging = true;
}

/**
 * 
 * @param {MouseEvent} event 
 * @param {number} timelineIndex 
 */
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

/**
 * 
 * @param {number} timelineIndex 
 */
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

/**
 * 
 * @param {string} groupName
 * @param {number} timelineIndex 
 */
function onCategoryClick(timelineIndex, groupName)
{
    //toggle enabled
    var categoryWidget = getTimeline(timelineIndex).tlCategories[groupName];
    categoryWidget.toggleEnabled();

}

/**
 * 
 * @param {string} debugStr 
 */
function setDebugText(debugStr)
{
    document.getElementById("debugText").innerText = debugStr;
}

//Static helpers
class TimelineHelper
{
    //LOG SCALE HELPERS
    /**
     * Convert value from log scale (zoom level) back to linear scale (timeline value)
     * @param {number} sliderVal 
     * @returns timeline value
     * */
    static SliderScaleToTimelineScale(sliderVal)
    {
        var zoomlevel = sliderVal * (maxZoom - minZoom) + minZoom;
        var timelineVal = 500.0 * Math.exp (zoomlevel);

        return timelineVal;
    }

    /**
     * Convert timeline value from linear scale to log scale (zoom level)
     * @param {number} timelineVal 
     * @returns zoom slider scale value
     */
    static TimelineScaleToSliderScale(timelineVal)
    {
        var zoomlevel = Math.log (timelineVal / 500.0);
        var sliderVal = ((zoomlevel - minZoom) / (maxZoom - minZoom));

        return sliderVal;
    }

    //ARRAY HELPERS
    /**
     * 
     * @param {*[]} arr an array
     * @param {*} value value to be removed from the array
     * @returns 
     */
    static removeItemOnce(arr, value) {
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
    static removeItemAll(arr, value) {
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

    //MATH HELPERS
    static Lerp(x,y, a)
    {
        return x*(1-a) + y*a;
    }


    //HTML Helpers
    /**
     * 
     * Create an HTML element <i></i> block surrounding the text
     * 
     * @param {string} text 
     * @returns 
     */
    static ItalicBlock(text)
    {
        var newBlock = document.createElement("i");
        newBlock.appendChild(this.TextBlock(text));
        return newBlock;
    }    
    
    /**
     * 
     * Create an HTML element <b></b> block surrounding the text
     * 
     * @param {string} text 
     * @returns 
     */
    static BoldBlock(text)
    {
        var newBlock = document.createElement("b");
        newBlock.appendChild(this.TextBlock(text));
        return newBlock;
    }

    static TextBlock(text)
    {       
        var newBlock = document.createTextNode(text);
        return newBlock;
    }

    /**
     * Wrap the input node with a new html tag
     * @param {string} htmlTagString 
     * @param {HTMLElement} childNode 
     * @returns {HTMLElement} the new parent node HTML element
     */
    static CreateParentNode(htmlTagString, childNode)
    {
        var newBlock = document.createElement(htmlTagString);
        newBlock.appendChild(childNode);
        return newBlock;
    }

    /**
     * 
     * Adds a paragraph
     * 
     * @param {HTMLElement} parent 
     * @param {string} text 
     * @param {boolean} italicise 
     * @returns 
     */
    static AddParagraph(parent, text, italicise)
    {
        var newPara = document.createElement("p");
        parent.appendChild(newPara);
        
        if(italicise!=undefined && italicise==true)
        {
            newPara.appendChild(TimelineHelper.ItalicBlock(text));
        }
        else
        {
            newPara.innerText = text;
        }

        return newPara;
    }
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