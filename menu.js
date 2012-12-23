function initializeMenu()
{
    $('.clickable').click(function(e){  e.preventDefault(); toggleContent(this);}   );
    $('.daySelected').click(function(e){    e.preventDefault(); toggleDay(this);}   );
    $("#li0").addClass("blackLine");

    $("#returnToMap").click(function(e)
    {  
            e.preventDefault();
            returnToMap();
    });

    $("#mapTab").click(function(e)
    {  
            e.preventDefault();
            returnToMap();
    });

    $("#statTab").click(function(e)
    {  
            e.preventDefault();
            returnToStats();
    });


}

function returnToMap()
{
    var statDiv = $("#statsDivWrapper");
    statDiv.removeClass("statsDivWrapper_Visible statsDivWrapper_Hidden");
    statDiv.addClass("statsDivWrapper_Hidden");
    $("#bar_chartWrapper").show();
}

function returnToStats()
{
    var statDiv = $("#statsDivWrapper");
    statDiv.removeClass("statsDivWrapper_Visible statsDivWrapper_Hidden");
    statDiv.addClass("statsDivWrapper_Visible");
    $("#bar_chartWrapper").hide();
}


function toggleDay(targ)
{
    var self = $(targ);
    var isActivated = self.hasClass("activated_day");

    self.removeClass("activated_day unactivated_day");

    if(isActivated)
    {
        self.addClass("unactivated_day");
    }
    else
    {
        self.addClass("activated_day");
    }
}

function toggleContent(targ)
{
    var self = $(targ);
    var next = self.next('li');
    var id = next.attr('id');

    var hasHiddenContent = $(next).hasClass("hidden_content");
    var hasVisibleContent = $(next).hasClass("visible_content");

    self.removeClass("blackLine whiteLine");

    if(hasHiddenContent)
    {
        $(next).removeClass("hidden_content");
        $(next).addClass("visible_content");
        self.addClass("blackLine");

    }
    else if(hasVisibleContent)
    {
        $(next).removeClass("visible_content");
        $(next).addClass("hidden_content");
        self.addClass("whiteLine");
    }
}