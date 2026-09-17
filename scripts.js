(function(){
  "use strict";

  var DAYS = ["SAT","SUN","MON","TUE","WED","THU","FRI"];
  var DAY_LABEL = {SAT:"Saturday",SUN:"Sunday",MON:"Monday",TUE:"Tuesday",WED:"Wednesday",THU:"Thursday",FRI:"Friday"};
  var DAY_SHORT_TO_KEY = {Sat:"SAT",Sun:"SUN",Mon:"MON",Tue:"TUE",Wed:"WED",Thu:"THU",Fri:"FRI"};

  var SLOTS = [
    {label:"08:15 – 09:45 AM", start:495,  end:585},
    {label:"09:45 – 11:15 AM", start:585,  end:675},
    {label:"11:15 AM – 12:45 PM", start:675, end:765},
    {label:"01:15 – 02:45 PM", start:795,  end:885},
    {label:"02:45 – 04:15 PM", start:885,  end:975},
    {label:"04:15 – 05:45 PM", start:975,  end:1065}
  ];

  var COURSES = {
    CSE443:{ code:"CSE 443", title:"Pattern Recognition", fCode:"HHS", faculty:"Hasibul Hossain Shajeeb", color:"var(--teal)" },
    CSE449:{ code:"CSE 449", title:"Data Mining", fCode:"AJK", faculty:"Ashfia Jannat Keya", color:"var(--gold)" },
    CSE450:{ code:"CSE 450", title:"Data Mining Lab", fCode:"AJK", faculty:"Ashfia Jannat Keya", color:"var(--burgundy)" },
    MGT401:{ code:"MGT 401", title:"Project Management and Professional Ethics", fCode:"SKD", faculty:"Sourav Kundu", color:"var(--indigo)" }
  };

  var SCHEDULE = {
    SAT: [null,null,null,null,null,null],
    SUN: [null,null,null,null,null,null],
    MON: [null, {code:"MGT401",room:"2319"}, {code:"CSE449",room:"2319"}, null, null, null],
    TUE: [{code:"CSE450",room:"2418"}, {code:"CSE450",room:"2418"}, null, null, null, null],
    WED: [null, null, null, {code:"CSE449",room:"2319"}, {code:"CSE443",room:"2319"}, null],
    THU: [null, {code:"MGT401",room:"2318"}, {code:"CSE443",room:"2318"}, null, null, null],
    FRI: [null,null,null,null,null,null]
  };

  var BUILDING_NAMES = { "2":"Martyr Sujan Mahmud Building", "3":"Martyr Tahmid Abdullah Building" };

  function splitRoom(code){
    return { building: code.charAt(0), number: code.slice(1) };
  }
  function roomLabel(code){
    var r = splitRoom(code);
    return "Building "+r.building+", Room "+r.number;
  }
  function roomLabelShort(code){
    var r = splitRoom(code);
    return "Building "+r.building+" · Room "+r.number;
  }
  function buildingTitle(code){
    var r = splitRoom(code);
    return BUILDING_NAMES[r.building] || "";
  }

  var state = { day: "SAT", view: "agenda", focus: null, dayAutoSelected: true };

  /* ---------- Theme ---------- */
  function initTheme(){
    var saved = null;
    try{ saved = localStorage.getItem("bubt-routine-theme"); }catch(e){}
    if(saved === "light" || saved === "dark"){
      document.documentElement.setAttribute("data-theme", saved);
    }
    updateThemeIcon();
  }
  function updateThemeIcon(){
    var btn = document.getElementById("themeToggle");
    var current = document.documentElement.getAttribute("data-theme");
    if(!current){
      current = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    btn.textContent = current === "dark" ? "\u2600" : "\u263E";
  }
  document.getElementById("themeToggle").addEventListener("click", function(){
    var current = document.documentElement.getAttribute("data-theme");
    if(!current){
      current = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try{ localStorage.setItem("bubt-routine-theme", next); }catch(e){}
    updateThemeIcon();
  });

  /* ---------- Dhaka clock ---------- */
  function dhakaParts(){
    var now = new Date();
    var weekday = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Dhaka", weekday:"short"}).format(now);
    var hh = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Dhaka", hour:"2-digit", hour12:false}).format(now);
    var mm = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Dhaka", minute:"2-digit"}).format(now);
    hh = parseInt(hh, 10) % 24;
    mm = parseInt(mm, 10);
    var display = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Dhaka", hour:"numeric", minute:"2-digit", hour12:true}).format(now);
    return { dayKey: DAY_SHORT_TO_KEY[weekday] || "SAT", minutes: hh*60+mm, display: display };
  }

  function fmtMinutesLeft(mins){
    if(mins < 60) return mins + " min";
    var h = Math.floor(mins/60), m = mins % 60;
    return h + "h " + (m ? m + "m" : "");
  }

  function defaultAgendaDay(t){
    var todaySlots = SCHEDULE[t.dayKey];
    var lastIdx = -1;
    for(var i=SLOTS.length-1;i>=0;i--){
      if(todaySlots[i]){ lastIdx = i; break; }
    }
    if(lastIdx !== -1 && t.minutes >= SLOTS[lastIdx].end){
      return DAYS[(DAYS.indexOf(t.dayKey)+1) % 7];
    }
    return t.dayKey;
  }

  function updateStatus(){
    var t = dhakaParts();
    document.getElementById("statusDay").textContent = DAY_LABEL[t.dayKey];
    document.getElementById("statusClock").textContent = t.display;

    if(state.dayAutoSelected){
      var next = defaultAgendaDay(t);
      if(next !== state.day){
        state.day = next;
        renderDayTabs();
        renderAgenda();
      }
    }

    var todaySlots = SCHEDULE[t.dayKey];
    var current = null, currentSlotIdx = -1;
    for(var i=0;i<SLOTS.length;i++){
      if(todaySlots[i] && t.minutes >= SLOTS[i].start && t.minutes < SLOTS[i].end){
        current = todaySlots[i]; currentSlotIdx = i; break;
      }
    }

    var dot = document.getElementById("statusDot");
    var label = document.getElementById("statusNextLabel");
    var body = document.getElementById("statusNextBody");

    if(current){
      dot.className = "status-dot live";
      label.textContent = "Happening now";
      var c = COURSES[current.code];
      body.innerHTML = "<b>"+c.code+"</b> \u00B7 "+c.title+" \u2014 "+roomLabel(current.room)+" \u00B7 ends in "+fmtMinutesLeft(SLOTS[currentSlotIdx].end - t.minutes);
      return;
    }

    dot.className = "status-dot";
    for(var offset=0; offset<8; offset++){
      var dIdx = (DAYS.indexOf(t.dayKey) + offset) % 7;
      var dKey = DAYS[dIdx];
      var slots = SCHEDULE[dKey];
      for(var s=0;s<SLOTS.length;s++){
        if(!slots[s]) continue;
        var startsInMinutes;
        if(offset === 0){
          if(SLOTS[s].start <= t.minutes) continue;
          startsInMinutes = SLOTS[s].start - t.minutes;
        } else {
          startsInMinutes = (offset*1440) - t.minutes + SLOTS[s].start;
        }
        var course = COURSES[slots[s].code];
        label.textContent = offset === 0 ? "Next class today" : "Next class \u00B7 " + DAY_LABEL[dKey];
        body.innerHTML = "<b>"+course.code+"</b> \u00B7 "+course.title+" \u2014 "+roomLabel(slots[s].room)+" \u00B7 in "+fmtMinutesLeft(startsInMinutes);
        return;
      }
    }
    label.textContent = "This week";
    body.textContent = "No more classes scheduled.";
  }

  /* ---------- Day tabs ---------- */
  function renderDayTabs(){
    var wrap = document.getElementById("dayTabs");
    wrap.innerHTML = "";
    var today = dhakaParts().dayKey;
    DAYS.forEach(function(day){
      var count = SCHEDULE[day].filter(Boolean).length;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-tab" + (day === state.day ? " active" : "") + (day === today ? " today" : "");
      btn.setAttribute("role","tab");
      btn.setAttribute("aria-selected", day === state.day ? "true" : "false");
      btn.innerHTML = "<span class='d-name'>"+day+"</span><span class='d-count'>"+(count ? count+" class"+(count>1?"es":"") : "free")+"</span>";
      btn.addEventListener("click", function(){ state.day = day; state.dayAutoSelected = false; renderDayTabs(); renderAgenda(); });
      wrap.appendChild(btn);
    });
  }

  /* ---------- Agenda ---------- */
  function renderAgenda(){
    var el = document.getElementById("agenda");
    var slots = SCHEDULE[state.day];
    var entries = [];
    slots.forEach(function(entry, idx){ if(entry) entries.push({entry:entry, slot:SLOTS[idx]}); });

    if(entries.length === 0){
      el.innerHTML = "<div class='agenda-empty'>No classes scheduled on "+DAY_LABEL[state.day]+".</div>";
      return;
    }

    var t = dhakaParts();
    var ul = document.createElement("ul");
    ul.className = "agenda-list";
    entries.forEach(function(item){
      var course = COURSES[item.entry.code];
      var isNow = state.day === t.dayKey && t.minutes >= item.slot.start && t.minutes < item.slot.end;
      var dimmed = state.focus && state.focus !== item.entry.code;
      var li = document.createElement("li");
      li.className = "agenda-item" + (isNow ? " is-now" : "") + (dimmed ? " is-dimmed" : "");
      li.style.setProperty("--course-color", course.color);
      li.innerHTML =
        "<div class='agenda-time mono'>"+item.slot.label+"</div>"+
        "<div class='agenda-card'>"+
          "<div class='agenda-course'>"+
            "<h3>"+course.title+(isNow ? " <span class='now-badge'>now</span>" : "")+"</h3>"+
            "<span class='agenda-code mono'>"+course.code+"</span>"+
          "</div>"+
          "<div class='agenda-sub'><span>"+course.faculty+" ("+course.fCode+")</span><span title='"+buildingTitle(item.entry.room)+"'>"+roomLabel(item.entry.room)+"</span></div>"+
        "</div>";
      ul.appendChild(li);
    });
    el.innerHTML = "";
    el.appendChild(ul);
  }

  /* ---------- Week grid ---------- */
  function renderGrid(){
    var table = document.getElementById("weekGrid");
    var today = dhakaParts().dayKey;
    var html = "<thead><tr><th>Day</th>";
    SLOTS.forEach(function(s){ html += "<th class='grid-slot'>"+s.label+"</th>"; });
    html += "</tr></thead><tbody>";
    DAYS.forEach(function(day){
      var dayEntries = SCHEDULE[day];
      var isFree = dayEntries.filter(Boolean).length === 0;
      html += "<tr><td class='day-cell"+(day===today?" today":"")+"' data-label='Day'>"+day+
        (isFree ? " <span class='day-free'>free</span>" : "")+"</td>";
      dayEntries.forEach(function(entry, idx){
        var label = SLOTS[idx].label;
        if(!entry){ html += "<td class='grid-cell-empty' data-label='"+label+"'><span class='grid-empty'>\u2014</span></td>"; return; }
        var course = COURSES[entry.code];
        var dimmed = state.focus && state.focus !== entry.code;
        html += "<td data-label='"+label+"'><div class='grid-course"+(dimmed?" is-dimmed":"")+"' style='--course-color:"+course.color+"'>"+
          "<div class='gc-code mono'>"+course.code+"</div>"+
          "<div class='gc-title'>"+course.title+"</div>"+
          "<div class='gc-room'>"+course.fCode+"</div>"+
          "<div class='gc-room' title='"+buildingTitle(entry.room)+"'>"+roomLabelShort(entry.room)+"</div>"+
          "</div></td>";
      });
      html += "</tr>";
    });
    html += "</tbody>";
    table.innerHTML = html;
  }

  /* ---------- Legend / focus ---------- */
  function renderLegend(){
    var el = document.getElementById("legend");
    el.innerHTML = "";
    Object.keys(COURSES).forEach(function(code){
      var c = COURSES[code];
      var card = document.createElement("button");
      card.type = "button";
      card.className = "legend-card" + (state.focus === code ? " is-focused" : "") + (state.focus && state.focus !== code ? " is-dimmed" : "");
      card.style.setProperty("--course-color", c.color);
      card.innerHTML =
        "<div class='legend-top'><span class='legend-code'>"+c.code+"</span></div>"+
        "<div class='legend-title'>"+c.title+"</div>"+
        "<div class='legend-faculty'>"+c.faculty+" \u00B7 "+c.fCode+"</div>";
      card.addEventListener("click", function(){
        state.focus = state.focus === code ? null : code;
        renderAll();
      });
      el.appendChild(card);
    });
    document.getElementById("clearFocus").className = "clear-focus" + (state.focus ? " show" : "");
  }
  document.getElementById("clearFocus").addEventListener("click", function(){
    state.focus = null; renderAll();
  });

  /* ---------- View switch ---------- */
  document.getElementById("btnAgenda").addEventListener("click", function(){ setView("agenda"); });
  document.getElementById("btnGrid").addEventListener("click", function(){ setView("grid"); });
  function setView(v){
    state.view = v;
    document.getElementById("btnAgenda").classList.toggle("active", v==="agenda");
    document.getElementById("btnAgenda").setAttribute("aria-selected", v==="agenda");
    document.getElementById("btnGrid").classList.toggle("active", v==="grid");
    document.getElementById("btnGrid").setAttribute("aria-selected", v==="grid");
    document.getElementById("agendaView").style.display = v==="agenda" ? "" : "none";
    document.getElementById("gridView").style.display = v==="grid" ? "" : "none";
    try{ localStorage.setItem("bubt-routine-view", v); }catch(e){}
  }

  function renderAll(){
    renderDayTabs();
    renderAgenda();
    renderGrid();
    renderLegend();
  }

  /* ---------- Init ---------- */
  initTheme();
  var savedView = null;
  try{ savedView = localStorage.getItem("bubt-routine-view"); }catch(e){}
  var t0 = dhakaParts();
  state.day = defaultAgendaDay(t0);
  renderAll();
  updateStatus();
  if(savedView === "grid") setView("grid");
  setInterval(function(){ updateStatus(); }, 30000);
})();
