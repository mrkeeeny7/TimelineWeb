
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
            var myObj = JSON.parse(this.responseText);
            var eventsString = "";
            eventsString += myObj.category + ": ";
            for(var i=0; i<myObj.eventlist.length; i++)
            {
                eventsString += myObj.eventlist[i].title + ", ";
            }
            document.getElementById("mainTable").innerHTML = eventsString;
        }
    };
    xmlhttp.open("GET", "timelines/timeline.json", true);
    xmlhttp.send();
}


function appendData(data) {
    var mainContainer = document.getElementById("mainTable");
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = 'Name: ' + data[i].firstName + ' ' + data[i].lastName;
        mainContainer.appendChild(div);
    }
}


