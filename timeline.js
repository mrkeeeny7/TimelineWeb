
function myfunc()
{

    var jsonData = JSON.parse()

    document.getElementById("mainTable")
    .innerHTML = "Testing";
}


function appendData(data) {
    var mainContainer = document.getElementById("mainTable");
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = 'Name: ' + data[i].firstName + ' ' + data[i].lastName;
        mainContainer.appendChild(div);
    }
}


