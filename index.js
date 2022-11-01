function index() {
    const calendarId = "pavlo.zamoroka@vaimo.com";
    const events = getEvents(calendarId);
    const currentEvent = getCurrentEvent(events);

    if (!currentEvent) return;


    const eventSummaryMapping = {
        'Lunch': {statusIcon: ':borscht:', statusText: 'Lunch'},
        'Sick leave': {statusIcon: ':pepe-sick:', statusText: 'Sick leave'},
        'On Leave - Morning': {statusIcon: ':pepe-sick:', statusText: 'Sick leave'},
        'Vacation': {statusIcon: ':palm_tree:', statusText: 'Vacation'},
        'Holidays in Ukraine': {statusIcon: ':beach_with_umbrella:', statusText: 'Day off'},
        'Public Holiday in Ukraine': {statusIcon: ':beach_with_umbrella:', statusText: 'Day off'},
        'no electricity': {statusIcon: ':electric_plug:', statusText: 'no electricity'},
    };

    const mappedEvent = eventSummaryMapping[currentEvent.summary] || null;
    if (mappedEvent) {
        updateStatusAndSnooze(mappedEvent.statusIcon, mappedEvent.statusText, currentEvent);
    } else if (currentEvent.eventType === 'focusTime') {
        updateStatusAndSnooze(':heads-down:', 'Focus Time', currentEvent)
    } else if (isOneToOne(currentEvent)) {
        updateStatusAndSnooze(':headphones:', 'In a huddle', currentEvent)
    } else {
        updateStatusAndSnooze(':spiral_calendar_pad:', 'In a meeting: ' + currentEvent.summary, currentEvent)
    }

    Logger.log(JSON.stringify(currentEvent));
}

function updateStatusAndSnooze(statusIcon, statusText, currentEvent) {
    const until = new Date(currentEvent.end.dateTime)
    console.log("until %s", until.toString());

    setStatus(statusIcon, statusText, until);
    snoozeNotifications(currentEvent, until);
}

function getEvents(calendarId) {
    const now = new Date();
    const events = Calendar.Events.list(calendarId, {
        timeMin: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10
    });
    if (!events.items || events === undefined || events.items.length === 0) {
        Logger.log('No events found.');
        return;
    }

    return events.items;
}

function getCurrentEvent(events) {
    const now = new Date();
    let currentEvent = null;

    events.find(function (event) {
        if (event.start.date) {
            // All-day event.
            event.start.dateTime = new Date(event.start.date);
            event.end.dateTime = new Date(event.end.date);
        }
        let start = new Date(event.start.dateTime);
        Logger.log(' Debug: (%s) %s', event.start.dateTime, event.summary);

        if (start <= now && getMe(event).responseStatus === 'accepted') {
            currentEvent = event;
            Logger.log(' Debug: currentEvent is (%s) %s', event.start.dateTime, event.summary);
            return currentEvent;
        }
    });
    return currentEvent;
}

function getMe(event) {
    if (event.attendees === undefined) {
        return {
            "self": true,
            "email": "pavlo.zamoroka@vaimo.com",
            "displayName": "pavlo.zamoroka@vaimo.com",
            "responseStatus": "accepted"
        };
    }
    return event.attendees.find(({self}) => self === true);
}

function setStatus(emoji, text, until) {
    const token = '----',
        url = "https://slack.com/api/users.profile.set",
        options = {
            "method": "POST",
            "headers": {
                "Content-type": "application/json; charset=utf-8",
                "Authorization": 'Bearer ' + token
            },
            "payload": JSON.stringify(
                {
                    "profile": {
                        "status_text": text,
                        "status_emoji": emoji,
                        "status_expiration": until.getTime() / 1000
                    }
                })
        };
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(response);

    Logger.log('%s %s until %s', emoji, text, until.toString());
}

function snoozeNotifications(event, until) {
    const now = new Date(),
        minutesToSnooze = Math.round(((until.getTime() / 1000) - (now.getTime() / 1000)) / 60);

    const token = '----',
        url = `https://slack.com/api/dnd.setSnooze?num_minutes=${minutesToSnooze}`,
        options = {
            "method": "POST",
            "headers": {
                "Content-type": "application/json; charset=utf-8",
                "Authorization": 'Bearer ' + token
            },
            "payload": JSON.stringify(
                {
                    "token": token,
                    "num_minutes": minutesToSnooze
                })
        };

    const response = UrlFetchApp.fetch(url, options);
    Logger.log(response);
    if (JSON.parse(response).ok === true) {
        Logger.log('Notifications snoozed until %s', until.toString());
    } else {
        Logger.log('Notifications not snoozed');
    }
}

function isOneToOne(event) {
    if (event.attendees === undefined) {
        return false;
    }

    return event.attendees.length === 2;
}
