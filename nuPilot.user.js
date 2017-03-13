// ==UserScript==
// @name          nuPilot
// @description   Planets.nu plugin to enable semi-intelligent auto-pilots
// @version       0.08.04
// @date          2017-03-13
// @author        drgirasol
// @include       http://planets.nu/*
// @include       http://play.planets.nu/*
// @include       http://test.planets.nu/*
// @resource	  Documentation https://github.com/drgirasol/nupilot/wiki
// @updateURL     https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.user.js
// @downloadURL   https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.user.js

// ==/UserScript==


function wrapper () { // wrapper for injection
	/*
	 *
	 */
	// add APC button to ShipOrders Section
	vgapShipScreen.prototype.load = function(c)
	{
        this.ship = c;
        this.ship.changed = 1;
        this.hull = vgap.getHull(c.hullid);
        var d = vgap.shipsAt(c.x, c.y);
        this.ships = d;
        this.showShipLocHistory = vgap.accountsettings.shiphistdef;
        this.shippath = 0;
        this.shipdestination = nu.t.none;
        this.starbase = null ;
        this.planet = vgap.planetAt(c.x, c.y);
        if (this.planet != null ) {
            this.starbase = vgap.getStarbase(this.planet.id);
        }
        this.missions = this.getMissionArray(c);
        var b = new Array();
        if (this.hull.id == 39 || this.hull.id == 41 || this.hull.id == 1034 || this.hull.id == 1039 || this.hull.id == 1041) {
            b.push({
                title: "pop - " + nu.t.activateglorydevice,
                desc: nu.t.popdef,
                code: "pop"
            });
            b.push({
                title: "trg - " + nu.t.triggerglorydevice,
                desc: nu.t.trgdef,
                code: "trg"
            })
        }
        if (c.torps > 0 || c.bays > 0) {
            b.push({
                title: "ntp - " + nu.t.notorpedosfighters,
                desc: nu.t.ntpdef,
                code: "ntp"
            })
        }
        if (c.torps > 0) {
            b.push({
                title: "mkt - " + nu.t.maketorpedos,
                desc: nu.t.mktdef,
                code: "mkt"
            });
            b.push({
                title: "msc - " + nu.t.minescoop,
                desc: nu.t.mscdef,
                code: "msc"
            });
            b.push({
                title: "btt - " + nu.t.beamtransfertorps,
                desc: nu.t.bttdef,
                code: "btt"
            })
        }
        if (c.bays > 0) {
            b.push({
                title: "btf - " + nu.t.beamtransferfighters,
                desc: nu.t.btfdef,
                code: "btf"
            })
        }
        b.push({
            title: "btm - " + nu.t.beamtransfermoney,
            desc: nu.t.btmdef,
            code: "btm"
        });
        if (this.planet != null ) {
            b.push({
                title: "bdm - " + nu.t.beamdownmoney,
                desc: nu.t.bdmdef + this.planet.name + ".",
                code: "bdm"
            })
        }
        if (c.bays > 0 && (vgap.player.raceid == 9 || vgap.player.raceid == 10 || vgap.player.raceid == 11)) {
            b.push({
                title: "lfm - " + nu.t.loadfighterminerals,
                desc: nu.t.lfmdef,
                code: "lfm"
            })
        }
        if (this.hull.id == 105 || this.hull.id == 104 || this.hull.id == 97) {
            b.push({
                title: "nal - " + nu.t.noalchemy,
                desc: nu.t.naldef,
                code: "nal"
            })
        }
        if (this.hull.id == 105) {
            b.push({
                title: "ald - " + nu.t.allduranium,
                desc: nu.t.alddef,
                code: "ald"
            });
            b.push({
                title: "alt - " + nu.t.alltritanium,
                desc: nu.t.altdef,
                code: "alt"
            });
            b.push({
                title: "alm - " + nu.t.allmolybdenum,
                desc: nu.t.almdef,
                code: "alm"
            });
            if (vgap.settings.fcodesextraalchemy) {
                b.push({
                    title: "nad - No Duranium",
                    desc: "Only produce tritanium and molybdenum from supplies.",
                    code: "nad"
                });
                b.push({
                    title: "nat - No Tritanium",
                    desc: "Only produce duranium and molybdenum from supplies.",
                    code: "nat"
                });
                b.push({
                    title: "nam - No Molybdenum",
                    desc: "Only produce duranium and tritanium from supplies.",
                    code: "nam"
                })
            }
        }
        if (vgap.player.raceid == 5 || vgap.player.raceid == 7) {
            b.push({
                title: "nbr - " + nu.t.noboardingparty,
                desc: nu.t.nbrdef,
                code: "nbr"
            })
        }
        this.fcodes = b;
        this.screen = new leftContent("ShipScreen",c.id + ": " + c.name,c,function() {
                vgap.map.deselectShip()
            }
        );
        this.screen.addFleetView();
        this.predictor(c);
        if (vgap.settings.isacademy) {
            c.warp = 1;
            var a = new Array();
            a.push({
                name: nu.t.mission,
                onclick: function() {
                    vgap.shipScreen.shipMission()
                }
            });
            if (this.planet != null ) {
                if (this.planet.ownerid == vgap.player.id || c.clans > 0 || c.transferclans > 0) {
                    a.push({
                        name: "Colonists",
                        onclick: function() {
                            vgap.shipScreen.academyClans()
                        }
                    })
                }
                if (this.starbase != null && this.planet.ownerid == vgap.player.id) {
                    if (c.torps > 0) {
                        a.push({
                            name: "Torpedos",
                            onclick: function() {
                                vgap.shipScreen.academyTorps()
                            }
                        })
                    }
                    if (c.bays > 0) {
                        a.push({
                            name: "Fighters",
                            onclick: function() {
                                vgap.shipScreen.academyFighters()
                            }
                        })
                    }
                }
            }
            this.screen.addSection("ShipStatus", "Actions", a, function() {
                return vgap.shipScreen.loadAcademy()
            }, "hull-" + c.hullid)
        } else {
            var a = new Array();
            if (this.hull.id != 112) {
                a.push({
                    name: nu.t.name,
                    onclick: function() {
                        vgap.shipScreen.changeName();
                    }
                });
            }
            if (c.hullid >= 200 && c.hullid < 300) {
                a = [];
            }
            a.push({
                name: nu.t.notes,
                onclick: function() {
                    shtml.editNote(c.id, 2);
                },
                id: "NoteButton"
            });
            this.screen.addSection("ShipStatus", this.hull.name, a, function() {
                return vgap.shipScreen.loadStatus();
            }, "hull-" + c.hullid);
            if (vgap.hasNote(c.id, 2)) {
                $("#NoteButton").addClass("GoodText");
            }
            if (c.hullid < 200 || c.hullid >= 300) {
                var a = new Array();
                if (this.planet != null || d.length > 1) {
                    a.push({
                        name: nu.t.transfer,
                        onclick: function() {
                            vgap.shipScreen.transfer()
                        }
                    })
                }
                if (this.planet == null ) {
                    a.push({
                        name: nu.t.jettison,
                        onclick: function() {
                            vgap.shipScreen.jettison()
                        }
                    })
                } else {
                    if (this.planet.ownerid == this.ship.ownerid) {
                        a.push({
                            name: "Unload",
                            onclick: function() {
                                vgap.shipScreen.unload()
                            }
                        })
                    }
                }
                if (c.hullid >= 200 && c.hullid < 300) {
                    a = new Array()
                }
                this.screen.addSection("ShipCargo", nu.t.cargo, a, function() {
                    return vgap.shipScreen.loadCargo()
                })
            }
            var a = [];
            a.push({
                name: nu.t.speed,
                onclick: function() {
                    vgap.shipScreen.warpSpeed();
                }
            });
            if (this.ship.hullid == 51 || this.ship.hullid == 87 || this.ship.hullid == 77 || this.ship.hullid == 110) {
                a.push({
                    name: "Hyperjump",
                    onclick: function() {
                        vgap.shipScreen.hyperjump()
                    }
                })
            }
            if (this.ship.hullid == 56 || this.ship.hullid == 1055) {
                a.push({
                    name: "Warp Chunnel",
                    onclick: function() {
                        vgap.shipScreen.chunnel()
                    }
                })
            }
            if (this.ship.hullid == 109 || this.ship.hullid == 1049 || this.ship.hullid == 1023) {
                a.push({
                    name: "Chameleon",
                    onclick: function() {
                        vgap.shipScreen.chameleon()
                    }
                })
            }
            a.push({
                name: nu.t.history,
                onclick: function() {
                    vgap.shipScreen.showShipLocHistory = !vgap.shipScreen.showShipLocHistory;
                    vgap.map.draw();
                }
            });
            if (c.hullid >= 200 && c.hullid < 300) {
                a = [];
            }
            this.screen.addSection("ShipMovement", nu.t.movement, a, function() {
                return vgap.shipScreen.loadMovement();
            }, "Movement");
            if (c.hullid < 200 || c.hullid > 300) {
                var a = new Array();
                if (vgap.player.raceid != 12)
                {
                    a.push({
                        name: "APC",
                        onclick: function() {
                            vgap.shipScreen.autopilotControl(this.planet);
                        }
                    });
                    a.push({
                        name: nu.t.friendly,
                        onclick: function() {
                            vgap.shipScreen.changeFriendly();
                        }
                    });
                }
                a.push({
                    name: nu.t.mission,
                    onclick: function() {
                        vgap.shipScreen.shipMission();
                    }
                });
                if (vgap.player.raceid != 12) {
                    a.push({
                        name: nu.t.enemy,
                        onclick: function() {
                            vgap.shipScreen.primaryEnemy();
                        }
                    });
                }
                this.screen.addSection("ShipOrders", nu.t.orders, a, function() {
                    return vgap.shipScreen.loadOrders();
                });
            }
        }
        vgap.callPlugins("loadship");
        vgap.hotkeysOn = true;
        vgap.action();
    };
	// display APC order selection dialog
	vgapShipScreen.prototype.autopilotControl = function()
	{
		var apcOptions = [
			{
				name: "Collect Resources",
			 	desc: "Collect resources and deliver them to the current planet.",
				shipFunction: "col",
				ooiOptions: [ "all", "neu", "dur", "tri", "mol", "cla", "mcs", "sup" ],
                action: false,
				hullId: 0
			},
			{
				name: "Distribute Resources",
				desc: "Distribute resources from sources to sinks.",
				shipFunction: "dis",
				ooiOptions: [ "neu", "cla", "sup", "mcs" ],
                action: false,
				hullId: 0
			},
			{
				name: "Alchemy",
				desc: "Load supply and unload products",
				shipFunction: "alc",
				ooiOptions: [ "all", "dur", "tri", "mol" ],
                action: false,
				hullId: 0
			},
			{
				name: "Colonize",
				desc: "Colonize unowned planets",
				shipFunction: "exp",
				ooiOptions: [ "cla" ],
                action: false,
				hullId: 0
			},
			{
				name: "Deactivate",
				desc: "Deactivate auto-pilot",
				shipFunction: "000",
				ooiOptions: [ false ],
                action: "END",
				hullId: 0
			}
		];
		var curMission = vgap.shipScreen.ship.mission;
		vgap.more.empty();
        $("<div id='OrdersScreen'><h1>Auto-Pilot-Control</h1></div>").appendTo(vgap.more);
		//
        for (var a = 0; a < apcOptions.length; a++)
		{
            if (this.planet || apcOptions[a].action)
            {
                var c = apcOptions[a];
                if (vgap.shipScreen.ship.hullid != 105 && c.shipFunction == "alc") continue; // only show alchemy module if its an alchemy ship
                //
                var setShipFunction = function (func, ooiPriority, action) {
                    return function () {
                        if (action) // is "END" = stop APS function
                        {
                            var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                            if (cfgData) {
                                cfgData.action = "END";
                                autopilot.syncLocalStorage(cfgData); // will remove entry and update ship
                            }
                        } else if (func && ooiPriority) // currently this is only relevant for Expander (colonize)
                        {
                            var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                            if (!cfgData) {
                                var baseId = 0;
                                var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                if (planet) baseId = planet.id;
                                var data = {
                                    sid: vgap.shipScreen.ship.id,
                                    base: baseId,
                                    shipFunction: func,
                                    ooiPriority: ooiPriority
                                };
                                var newAPS = new APSdata(data);
                                //cfgData = autopilot.syncLocalStorage(data); // will get default cfgData (=data)
                                autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS);
                            }
                            // else... function already set for APS - do nothing
                        }
                        vgap.shipScreen.selectMission(curMission);
                    };
                };
                if (c.ooiOptions.length > 1) {
                    $("<div>" + c.name + "<span>" + c.desc + "<br/>Priority: <b id='ooiPriority" + c.shipFunction + "'></b></span></div>").tclick(setShipFunction(false, false, false)).appendTo("#OrdersScreen");
                    for (var j = 0; j < c.ooiOptions.length; j++) {
                        var setShipFunctionOoi = function (func, ooiPriority) {
                            return function () {
                                var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                                if (!cfgData) {
                                    var baseId = 0;
                                    var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                    if (planet) baseId = planet.id;
                                    var data = {
                                        sid: vgap.shipScreen.ship.id,
                                        base: baseId,
                                        shipFunction: func,
                                        ooiPriority: ooiPriority
                                    };
                                    var newAPS = new APSdata(data);
                                    //cfgData = autopilot.syncLocalStorage(data); // will get default cfgData (=data)
                                    autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS);
                                } else {
                                    cfgData.shipFunction = func;
                                    cfgData.ooiPriority = ooiPriority;
                                    //cfgData = autopilot.syncLocalStorage(cfgData); // will get default cfgData (=data)
                                    autopilot.updateAPS(vgap.shipScreen.ship.id, cfgData);
                                }
                                return false;
                            };
                        };
                        $("<a style='color:cyan;font-size: 10px;'>" + c.ooiOptions[j] + " </a>").tclick(setShipFunctionOoi(c.shipFunction, c.ooiOptions[j])).appendTo("#ooiPriority" + c.shipFunction);
                    }
                } else {
                    $("<div>" + c.name + "<span>" + c.desc + "</span></div>").tclick(setShipFunction(c.shipFunction, c.ooiOptions[0], c.action)).appendTo("#OrdersScreen");
                }
            }
        }
        shtml.moreBack();
        vgap.showMore();
	};
	// display current APC "orders" -> loadOrders
	vgapShipScreen.prototype.autopilotInfo = function(r)
	{
		var apcFunctions = {
			col: "Collect",
			dis: "Distribute",
			exp: "Colonize",
			alc: "Alchemy"
		};
		var apcPriorities = {
			all: "Dur/Tri/Mol",
			neu: "Neutronium",
			dur: "Duranium",
			tri: "Tritanium",
			mol: "Molybdenum",
			sup: "Supplies",
			mcs: "Megacredits",
			cla: "Clans"
		};
		var h = "";
		var apcData = autopilot.isInStorage(r.id);
		if (apcData)
		{
			h += "<table width='100%'><tr><td class='widehead' data-topic='ShipAutoPilot'>APC:</td><td class='textval'>";
			h += apcFunctions[apcData.shipFunction] + " " + apcPriorities[apcData.ooiPriority];
			h += " <span class='valsup'>(Base: " + apcData.base;
			if (apcData.destination) h += " |-> " + apcData.destination;
			h += ")</span>";
			h += "</td></tr>";
			h += "</table>";
		}
		return h;
	};
	vgapShipScreen.prototype.loadOrders = function()
	{
        var r = this.ship;
        var h = "<table width='100%'>";
        var f = nu.t.none;
        if (r.enemy > 0) {
            var o = vgap.getPlayer(r.enemy);
            var p = vgap.getRace(o.raceid);
            f = p.name + " (" + o.username + ")";
        }
        if (vgap.player.raceid != 12) {
            h += "<tr><td class='widehead' data-topic='PrimaryEnemy'>" + nu.t.primaryenemy + ":</td><td class='textval'>" + f + "</td></tr></table>";
        }
        h += "<table width='100%'><tr><td class='widehead' data-topic='ShipMissions'>" + nu.t.mission + ":</td><td class='textval'>";
        var m = null ;
        if (r.mission1target != 0) {
            m = vgap.getShip(r.mission1target);
        }
        if (r.mission == 6 && m != null ) {
            h += "Tow ship " + m.id + ": " + m.name.substr(0, 30);
        } else {
            if (r.mission == 6) {
                h += "Tow: <span class=BadText>No Target</span>";
            } else {
                if (r.mission == 7 && m != null ) {
                    h += "Intercept ship " + m.id + ": " + m.name.substr(0, 30);
                } else {
                    if (r.mission == 7) {
                        h += "Intercept: <span class=BadText>No Target</span>";
                    } else {
                        if (r.mission == 20 && m != null ) {
                            h += "Cloak and Intercept ship " + m.id + ": " + m.name.substr(0, 30);
                        } else {
                            if (r.mission == 20) {
                                h += "Cloak and Intercept: <span class=BadText>No Target</span>";
                            } else {
                                if (r.mission == 15 && m != null ) {
                                    h += "Repair ship " + m.id + ": " + m.name.substr(0, 30);
                                } else {
                                    if (r.mission == 15) {
                                        h += "Repair: <span class=BadText>No Target</span>";
                                    } else {
                                        if (r.mission == 18 && (r.mission1target == null || r.mission1target == 0)) {
                                            h += "Send Fighters to All Receivers";
                                        } else {
                                            if (r.mission == 18) {
                                                var q = "<span class=BadText>Invalid Target</span>";
                                                if (r.mission1target < 1000 && r.mission1target > -1000) {
                                                    var m = vgap.getShip(r.mission1target);
                                                    if (m != null ) {
                                                        q = m.id + ": " + m.name;
                                                    }
                                                } else {
                                                    var n = vgap.getPlanet(r.mission1target % 1000);
                                                    if (n != null ) {
                                                        q = n.id + ": " + n.name;
                                                    }
                                                }
                                                h += "Send Fighters to " + q;
                                            } else {
                                                if (r.mission == 2 || (r.mission == 8 && vgap.player.raceid == 7)) {
                                                    var s = this.getMineUnits(r);
                                                    h += this.getMission(r.mission).name + " <span class='valsup'>(convert " + r.minelaytorps + " torps into " + s + " " + (r.mission == 2 ? "" : "web ") + "mines)</span>";
                                                } else {
                                                    h += this.getMission(r.mission).name;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (r.mission == 1) {
            var a = r.beamid;
            if (vgap.player.raceid == 12) {
                a = Math.floor((r.clans / vgap.getHull(r.hullid).cargo) * 9) + 1;
            }
            h += " <span class='valsup'>(" + r.beams * a * a * 4 + " mines / " + r.beams * a * a * 3 + " web mines)</span>";
        }
        if (r.mission == 9 || (vgap.player.raceid == 3 && r.mission == 8)) {
            h += " <span class='valsup'>(" + vgap.cloakFuel(r) + " fuel / turn)</span>";
        }
        h += "</td></tr>";
        h += "</table>";
		// auto pilot control info
		h += vgap.shipScreen.autopilotInfo(r);
		//
        var b = null ;
        if (r.hullid == 1023 || r.hullid == 109 || r.hullid == 1049) {
            var d = parseInt(r.friendlycode);
            var c = vgap.getHull(d);
            if (c != null && c.id != 0) {
                b = c;
            }
        }
        if (vgap.player.raceid != 12) {
            var g = "transparent";
            fcu = r.friendlycode.toUpperCase();
            if (fcu == "HYP" && (r.hullid == 51 || r.hullid == 87 || r.hullid == 77)) {
                g = "yellow";
            } else {
                if (fcu == "BDM" || fcu == "BTM") {
                    g = "limegreen";
                } else {
                    if (vgap.settings.fcodesbdx && fcu.match(/BD[0-9HQ]/)) {
                        g = "limegreen";
                    } else {
                        if (fcu == "NAL" && (r.hullid == 97 || r.hullid == 104 || r.hullid == 105)) {
                            g = "red";
                        } else {
                            if ((fcu == "ALT" || fcu == "ALD" || fcu == "ALM") && r.hullid == 105) {
                                g = "orange";
                            } else {
                                if (vgap.settings.fcodesextraalchemy && (fcu == "NAT" || fcu == "NAD" || fcu == "NAM") && r.hullid == 105) {
                                    g = "orange";
                                } else {
                                    if (fcu == "NTP" || fcu == "NBR") {
                                        g = "orchid";
                                    } else {
                                        if (fcu == "MKT" || fcu == "LFM") {
                                            g = "orange";
                                        } else {
                                            if ((fcu == "POP" || fcu == "TRG") && (r.hullid == 39 || r.hullid == 41 || r.hullid == 1034 || r.hullid == 1039 || r.hullid == 1041)) {
                                                g = "red";
                                            } else {
                                                if (fcu == "MSC") {
                                                    g = "aqua";
                                                } else {
                                                    if (fcu == "BTT" || fcu == "BTF") {
                                                        g = "lightcoral";
                                                    } else {
                                                        if (fcu.match(/GS[1-9A-Z]/)) {
                                                            g = "magenta";
                                                        } else {
                                                            if (fcu.match(/MD[0-9HQA]/)) {
                                                                g = "#099";
                                                            } else {
                                                                if (fcu.match(/MI[1-9A-Z]/)) {
                                                                    g = "orange";
                                                                } else {
                                                                    if (b) {
                                                                        g = "magenta";
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (b) {
                h += "<table width='100%'><tr><td class='widehead' data-topic='FriendlyCodes'>Chameleon:</td><td class='textval' style='color:magenta;'>" + b.name + " <span class='valsup'>(10 fuel / turn)</span></td><td class='fc'><span style='background-color: " + g + "'  id='ShipFC'>" + r.friendlycode + "</span></td></tr></table>"
            } else {
                h += "<table width='100%'><tr><td class='widehead' data-topic='FriendlyCodes'>" + nu.t.friendlycode + ":</td><td class='fc'><span style='background-color: " + g + "'  id='ShipFC'>" + r.friendlycode + "</span></td></tr></table>"
            }
            if (vgap.advActive(61)) {
                var e = 0;
                for (var k = 0; k < vgap.messages.length; k++) {
                    var l = vgap.messages[k];
                    if (l.target == r.id && l.messagetype == 20 && l.body.indexOf("ship nearby") >= 0) {
                        e++
                    }
                }
                if (e > 0) {
                    h += "<table width='100%'><tr><td class='widehead' data-topic='FriendlyCodes'>Dark Sense:</td><td class='textval' style='color:magenta;'>" + e + " hidden ships nearby</td></tr></table>"
                }
            }
        }
        return h;
    };
	//
    sharedContent.prototype.shipScan = function(e)
    {
        var d = vgap.getHull(e.hullid);
        var c = "<div class='ItemSelection' data-id='" + e.id + "'>";
        c += "<img src='" + e.img + "'/>";
        var a = "";
        if (vgap.allied(e.ownerid) && e.ownerid != vgap.player.id) {
            a = "AllyText"
        } else {
            if (e.ownerid != vgap.player.id) {
                a = "BadText"
            }
        }
        c += "<span class='" + a + "'>" + Math.abs(e.id) + ": " + e.name + "</span>";
        c += "<span class='" + a + "'>" + d.name + "</span>";
        var b = e.heading;
        if (b == -1) {
            b = nu.t.unknown
        }
        var f = vgap.isTowTarget(e.id);
        if (f != null ) {
            c += "<span style='color:#990099;'>" + nu.t.towedbyship + " #" + f.id + ": " + f.name + "</span>"
        } else {
            c += "<span class='" + a + "'>" + nu.t.heading + ": " + b;
            if (!vgap.settings.isacademy) {
                c += " " + nu.t.atwarp + ": " + e.warp
            }
            c += "</span>"
        }
        c += "<span class='" + a + "'>" + nu.t.mass + ": " + e.mass + " (" + (e.mass - d.mass) +")</span>";
        if (e.ownerid != vgap.player.id) {
            c += "<span class='" + a + "'>" + vgap.raceName(e.ownerid) + "</span>"
        }
        c += "</div>";
        return c
    };
	/*
     *
     *  Fixed Radius Near Neighbor (FRNN) Object
     *
     *  usage: method .inRange(poi, r, callback, delay, duration)
     *
     *    Required
     *    - poi: position of interest = [x,y]
     *    - r: radius (default: 100 ly)
     *    Optional:
     *    - callback: ?
     *    - delay: ?
     *    - duration: ?
     */
	function FRNN(points, r)
	{
		this.points = points;
		this.r = r ? r : 100;
		this.buckets = {};

		var buckets = this.buckets;
		(function build() {
			points.forEach(function(point) {
				var key = FRNN.prototype._toKey(point, r);
				if (!(key in buckets)) {
					buckets[key] = [point];
				} else {
					buckets[key].push(point);
				}
			});
		})();
	}
	/*
     *  return bucket key for coordinate position (point) using a fixed radius (r)
     */
	FRNN.prototype._toKey = function(point, r)
	{
		var i1 = Math.floor(point.x/r);
		var i2 = Math.floor(point.y/r);

		return i1 + "|" + i2;
	};
	/*
     *  return distance between two points
     */
	FRNN.prototype._distance = function(p1, p2) {
		return Math.sqrt(Math.pow((p1.x - p2.x),2) + Math.pow((p1.y - p2.y),2));
	};
	/*
     *  return key(s) of (all) neighbor bucket(s)
     */
	FRNN.prototype._getNeighborBuckets = function(bucket) {
		var buckets = this.buckets;
		var splitBucket = bucket.split("|");
		var i1 = parseInt(splitBucket[0]);
		var i2 = parseInt(splitBucket[1]);
		//
		var topRight = (i1 + 1) + "|" + (i2 - 1);
		var right = (i1 + 1) + "|" + i2;
		var bottomRight = (i1 + 1) + "|" + (i2 + 1);
		var bottom = i1 + "|" + (i2 + 1);
		var bottomLeft = (i1 - 1) + "|" + (i2 + 1);
		var left = (i1 - 1) + "|" + i2;
		var topLeft = (i1 - 1) + "|" + (i2 - 1);
		var top = i1 + "|" + (i2 - 1);
		//
		var potentials = [topRight, right, bottomRight, bottom, bottomLeft, left, topLeft, top];
		var forwards = [];
		potentials.forEach(function(p) {
			if (p in buckets) forwards.push(p);
		});
		return forwards;
	};
	FRNN.prototype.inRange = function(poi, r, callback, delay, duration) {
		// key of poi bucket (point of interest)
		var poiBucket = this._toKey(poi,r);
		// all keys of adjecent buckets
		var neighbors = this._getNeighborBuckets(poiBucket);
		// + key of poi bucket
		neighbors.push(poiBucket);

		// coordinates that are in range...
		var inRange = [];
		var count = 0;

		for (var i=0;i<neighbors.length;i++)
		{
			if (neighbors[i] in this.buckets)
			{
				var curBucket = this.buckets[neighbors[i]];
				for (var j = 0; j < curBucket.length; j++)
				{
					var distance = this._distance(poi, curBucket[j]);
					if (distance <= this.r && distance > 0) // we don't want the coordinate of the poi
					{
						if (typeof callback != "undefined") callback(poi, curBucket[j], count, delay, duration);
						inRange.push(curBucket[j]);
						count++;
					}
				}
			}
		}
		return inRange;
	};
		/*
	 * Autopilot - Alchemy Module
	 */
	function alchemyAPS()
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
        this.turnRangeAmp = 1;
		this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
		this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
		this.ooiPriority = "all"; // object of interest (ooi) priority: always "cla"
		this.alwaysLoadMC = true; // freighter missions will always include MCs
		this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
		this.supplyRetentionAmount = 150; // if selling supplies, we keep some for other purposes
		this.fuelRetentionMass = 500;
		this.mcRetentionAmount = 100;
		this.enemySafetyZone = 81; // radius of each enemy planet and ship that will be avoided by us (planets in that range are not used as targets)
		// fixed to ship porperties
		this.devideThresh = 0;
		// data container
		this.frnnSources = [];
		this.sources = [];
		this.frnnSinks = [];
		this.sinks = [];
	}
	alchemyAPS.prototype.setSinks = function(aps)
	{
		// as alchemist, current planet is a sink
		this.sinks = [{ x: aps.ship.x, y: aps.ship.y , distance: 0, deficiency: 0}];
	};
	alchemyAPS.prototype.setSources = function(aps)
	{
		// as alchemist, current planet is a sink and source
		this.sources = [{ x: aps.ship.x, y: aps.ship.y , distance: 0, deficiency: 0}];
	};
	alchemyAPS.prototype.isSource = function(planet)
	{
		if (planet.supplies > 0) return true;
		return false;
	};
    alchemyAPS.prototype.setSecondaryDestination = function(aps)
    {

    };
    alchemyAPS.prototype.setPotentialWaypoints = function(aps)
    {
        aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    };
	alchemyAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (aps.destination) return;
		console.log("Determine potential destinations...");
		// by planet.id sorted sinks (deficiencies)
		if (this.sinks.length === 0) this.setSinks(aps);
		// by planet.id sorted sources (two piles -high/low value- by distance)
		if (this.sources.length === 0) this.setSources(aps);

		if (aps.potDest.length === 0)
		{
			console.log("setPotentialDestinations: no destinations available...");
		} else
		{
			console.log(aps.potDest);
		}
	};
    alchemyAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        // aps.potDest = aps.potDest;
    };
	alchemyAPS.prototype.updateFC = function(aps)
	{
		if (this.ooiPriority == "all")
		{
			aps.ship.friendlycode = "abc"; // toDo: random FC
		} else if (this.ooiPriority == "dur")
		{
			aps.ship.friendlycode = "ald";
		} else if (this.ooiPriority == "tri")
		{
			aps.ship.friendlycode = "alt";
		} else if (this.ooiPriority == "mol")
		{
			aps.ship.friendlycode = "alm";
		}
	};
	alchemyAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			aps.unloadCargo();
			var transCargo = this.loadCargo(aps);
			console.log("Cargo summary: " + transCargo);
		}
	};
	alchemyAPS.prototype.loadCargo = function(aps)
	{
        var curCargo = aps.ship.supplies;
	    var supToLoad = aps.getObjectExcess(aps.planet, "sup");
        if (supToLoad > 0)
        {
            curCargo = aps.loadObject("supplies", aps.planet, supToLoad);
        }
        return curCargo;

	};
	/*
	 * Autopilot - Expansion Module
	 * toDo: major rework...
     *      - an expander's destination is always an unowned planet (sink)!
	 */
	function expanderAPS()
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
        this.turnRangeAmp = 1;
        this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
		this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
		this.ooiPriority = "cla"; // object of interest (ooi) priority: always "cla"
		this.alwaysLoadMC = true; // freighter missions will always include MCs
		this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
		this.supplyRetentionAmount = 150; // if selling supplies, we keep some for other purposes
		this.fuelRetentionMass = 500;
		this.mcRetentionAmount = 100;
		this.enemySafetyZone = 81; // radius of each enemy planet and ship that will be avoided by us (planets in that range are not used as targets)
		// fixed to ship porperties
		this.devideThresh = 0;
		// data container
		this.frnnSources = [];
		this.sources = [];
		this.frnnSinks = [];
		this.sinks = [];
	}
	expanderAPS.prototype.setSinks = function(aps)
	{
		// as expander, each unowned planet is a sink
		// and the object of interest will always be clans
        // however, if it would be known that there are natives (bioscan) priority could be used for those planets
        // the same goes for planets where the resources are known
        this.setScopeRange(aps);
        var targetsInRange = aps.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
        console.log("... targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
        var withNatives = [];
        var amorph = [];
        var potential = [];
		for (var i = 0; i < targetsInRange.length; i++)
		{
			var sP = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
            var shipsAtSink = vgap.shipsAt(targetsInRange[i].x, targetsInRange[i].y);
            if (shipsAtSink.length > 0)
            {
                console.log("... there are ships at sink... removing planet " + sP.id);
                continue;
            }
			var distance = Math.floor(autopilot.getDistance({x: sP.x, y: sP.y}, {x:aps.ship.x ,y:aps.ship.y}));
            var deficiency = 150;
            // this.frnnSinks.push({x: sP.x, y: sP.y}); // redundant?
            //console.log("...distance: " + distance + " / range: " + Math.pow(aps.hull.engineid, 2));
            if (sP.nativeclans > 0 && sP.nativeracename == "Amorphous")
            {
                console.log("... there are amorphous natives living on " + sP.id + " ... sorting to the back...");
                amorph.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename });
                continue;
            } else if (sP.nativeclans > 0 && distance <= (2 * Math.pow(aps.ship.engineid, 2))) // only if in 2-turn range
            {
                console.log("... there are natives living on " + sP.id + " ...prioritise...");
                withNatives.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename  });
                continue;
            }
            potential.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename  });
		}
        console.log("... potential targets: " + potential.length);
        console.log("... amorph targets: " + amorph.length);
        console.log("... other native targets: " + withNatives.length);
        potential = autopilot.sortCollection(potential, "distance");
        if (potential.length > 0)
        {
            if (withNatives.length > 0)
            {
                // putting native planets to the top of the line...
                withNatives = autopilot.sortCollection(withNatives, "distance");
                potential = withNatives.concat(potential);
            }
            if (amorph.length > 0)
            {
                // putting amorph planets to the end of the line...
                potential = potential.concat(amorph);
            }
            this.sinks = potential;
        } else
        {
            if (withNatives.length > 0)
            {
                // putting native planets to the top of the line...
                withNatives = autopilot.sortCollection(withNatives, "distance");
                potential = withNatives;
            }
            if (amorph.length > 0)
            {
                // putting amorph planets to the end of the line...
                if (potential.length > 0)
                {
                    potential = potential.concat(amorph);
                } else
                {
                    potential = amorph;
                }
            }
            this.sinks = potential;
        }
	};
    expanderAPS.prototype.setScopeRange = function(aps)
    {
        var inRange = aps.getAPSinRange(aps.scopeRange);
        if (inRange.length > 3)
        {
            aps.scopeRange *= 3;
        } else
        {
            aps.scopeRange *= 2;
        }
    };
	expanderAPS.prototype.setSources = function(aps)
	{
		// sources are the same as for a clan distributer...
		this.sources = autopilot.clanSources;
        console.log("... initialSources: " + this.sources.length);
		var cutOff = this.getExpanderKit(aps, true);
        var goodSources = [];
		for (var i = 0; i < this.sources.length; i++)
		{
			var sourcePlanet = vgap.getPlanet(this.sources[i].pid);
            var clans = aps.getObjectExcess(sourcePlanet, "cla");
            var supplies = aps.getObjectExcess(sourcePlanet, "sup");
            var mcs = aps.getObjectExcess(sourcePlanet, "mcs");
            if ((clans >= cutOff.cla && supplies >= cutOff.sup) || sourcePlanet.id == aps.base.id) // ignore mcs; always add the base planet, regardless if everything is available
            //if ((clans >= cutOff.cla && supplies >= cutOff.sup && mcs >= cutOff.mcs) || sourcePlanet.id == aps.base.id) // always add the base planet, regardless if everything is available
            {
                var distance = Math.floor(autopilot.getDistance({x: sourcePlanet.x, y: sourcePlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
                this.sources[i].value = clans;
                this.sources[i].distance = distance;
                goodSources.push(this.sources[i]);
            } else
            {
                console.log("... planet " + this.sources[i].pid + " has no expander kit to offer!");
            }
		}
		this.sources = autopilot.sortCollection(goodSources, "distance");
		console.log(this.sources);
	};
	expanderAPS.prototype.isSource = function(planet)
	{
		for (var i = 0; i < this.sources.length; i++)
		{
			if (this.sources[i].pid == planet.id) return true;
		}
		return false;
	};
    expanderAPS.prototype.setSecondaryDestination = function(aps)
    {
        // check if cargo or planet contains expanderKit
        var planetKit = false;
        if (aps.planet)
        {
           planetKit = this.planetHasExpKit(aps, true);
        }
        if (!this.hasExpKit(aps) && !planetKit)
        {
            console.log("...insufficient cargo!");
            // we are lacking something, set closest source as secondary destination
            // - only planets that are not destination of another aps that will pickup material we need
            this.setSources(aps);
            if (this.sources.length > 0)
            {
                aps.secondaryDestination = vgap.getPlanet(this.sources[0].pid);
                console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
            } else
            {
                // no secondary destination (sufficient source) found
                console.log("...couldn't find an adequate secondary destination.");
                aps.secondaryDestination = aps.planet;
            }
        }
    };
	expanderAPS.prototype.setPotentialWaypoints = function(aps)
    {
        aps.potentialWaypoints = autopilot.frnnOwnPlanets;
        if (aps.destination.ownerid != vgap.player.id)
        {
            aps.potentialWaypoints.push({ pid: aps.destination.id, x: aps.destination.x, y: aps.destination.y });
        }
    };
	expanderAPS.prototype.setPotentialDestinations = function(aps)
	{
		console.log("Determine potential destinations...");
        this.setSinks(aps);
		if (this.sinks.length === 0)
		{
            console.warn("...no potential destinations available!");
            aps.isIdle = true;
            aps.updateStoredData();
        } else
		{
            aps.potDest = this.sinks;
            aps.isIdle = false;
            aps.updateStoredData();
		}
        console.log(aps.potDest);
	};
    expanderAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        // aps.potDest = aps.potDest;
    };
	expanderAPS.prototype.handleCargo = function (aps) // called on arrival at destination and when at owned planet
	{
	    if (aps.planet)
        {
            if (!aps.isOwnPlanet)
            {
                // = new colony
                aps.unloadCargo();
            } else
            {
                var transCargo = this.loadCargo(aps);
            }
        }
	};
    expanderAPS.prototype.getExpanderKit = function(aps, minimal)
    {
        // default:
        // 75 % of cargo = clans,
        // 25 % of cargo = supply,
        // 3 * supply = mcs (factory building)
        //
        var kits = 1;
        var clans = Math.floor(0.75 * aps.hull.cargo);
        var sups = aps.hull.cargo - clans;
        var mcs = 3 * (aps.hull.cargo - clans);
        if (clans > 150)
        {
            kits = Math.floor(clans / 150);
            clans = 150 * kits;
            sups = 50 * kits;
            mcs = 3 * sups;
        }
        if (typeof minimal == "undefined")
        {
            return {
                cla: clans,
                sup: sups,
                mcs: mcs
            }
        } else
        {
            if (clans > 150)
            {
                return {
                    cla: 150,
                    sup: 50,
                    mcs: 150
                }
            } else {
                return {
                    cla: clans,
                    sup: sups,
                    mcs: mcs
                }
            }
        }
    };
	expanderAPS.prototype.hasExpKit = function(aps)
    {
        var expanderKit = this.getExpanderKit(aps, true);
        return (aps.ship.clans >= expanderKit.cla && aps.ship.supplies >= expanderKit.sup); // ignore mcs
        //return (aps.ship.clans >= expanderKit.cla && aps.ship.supplies >= expanderKit.sup && aps.ship.megacredits >= expanderKit.mcs);
    };
	expanderAPS.prototype.planetHasExpKit = function(aps, partially)
    {
        var expanderKit = this.getExpanderKit(aps, true);
        var plCla = aps.getObjectExcess(aps.planet, "cla");
        var plSup = aps.getObjectExcess(aps.planet, "sup");
        var plMcs = aps.getObjectExcess(aps.planet, "mcs");
        if (typeof partially == "undefined")
        {
            return (plCla >= expanderKit.cla && plSup >= expanderKit.sup && plMcs >= expanderKit.mcs);
        } else
        {
            // partially = minimum clans
            return (plCla >= expanderKit.cla);
        }
    };
	expanderAPS.prototype.loadCargo = function(aps)
	{
        var curCargo = 0;
        var expanderKit = this.getExpanderKit(aps);
        if (!this.hasExpKit(aps) && this.planetHasExpKit(aps, true))
        {
            var kDiffCla = aps.ship.clans - expanderKit.cla;
            var kDiffSup = aps.ship.supplies - expanderKit.sup;
            var kDiffMcs = aps.ship.megacredits - expanderKit.mcs;
            //
            if (kDiffCla < 0)
            {
                curCargo = aps.loadObject("clans", aps.planet, (kDiffCla*-1));
            }
            if (kDiffSup < 0)
            {
                curCargo += aps.loadObject("supplies", aps.planet, (kDiffSup*-1));
            }
            if (kDiffMcs < 0)
            {
                aps.loadObject("megacredits", aps.planet, (kDiffMcs*-1));
            }
        }
        console.log("[" + aps.ship.id + "]-| loadCargo: " + curCargo);
		return curCargo;
	};
	expanderAPS.prototype.transferCargo = function(aps)
    {
        if (aps.planet && !aps.isOwnPlanet)
        {
            var unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
            var maxAmounts = [0, 0, 0, 50, 150, 150];
            for (var i = 0; i < unloadingSequence.length; i++)
            {
                var cargo = unloadingSequence[i];
                var amount = maxAmounts[i];
                if (parseInt(aps.ship[cargo]) <= amount)
                {
                    amount = parseInt(aps.ship[cargo]);
                }
                aps.transferObject(cargo, aps.planet, amount);
            }
        }
    };
	/*
	 * Autopilot - Collector Module
	 */
	function collectorAPS()
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
        this.turnRangeAmp = 1;
        this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
		this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
        this.ooiPriority = "all"; // object of interest (ooi) priority: "all" (=dur, tri, mol), "dur", "tri", "mol", "mcs", "sup", "cla"
		this.alwaysLoadMC = true; // freighter missions will always include MCs
		this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
		this.supplyRetentionAmount = 150; // if selling supplies, we keep some for other purposes
		this.fuelRetentionMass = 500;
		this.mcRetentionAmount = 100;
		this.enemySafetyZone = 81; // radius of each enemy planet and ship that will be avoided by us (planets in that range are not used as targets)
		// fixed to ship porperties
		this.devideThresh = 0;
		// data container
		this.frnnSources = [];
		this.sources = [];
		this.frnnSinks = [];
		this.sinks = [];
	}
	collectorAPS.prototype.setSinks = function(aps)
	{
		// as collector, the base is always the sink
		if (this.ooiPriority == "all")
		{
			var buildres = 0;
			this.sinks = [{ x: aps.base.x, y: aps.base.y, pid: aps.base.id, deficiency: buildres }];
		} else
		{
			var priorityres = 0;
			this.sinks = [{ x: aps.base.x, y: aps.base.y, pid: aps.base.id, deficiency: priorityres }];
		}
	};
	collectorAPS.prototype.setScopeRange = function(aps)
    {
        var inRange = aps.getAPSinRange(aps.scopeRange);
        if (inRange.length > 5 || this.ooiPriority == "cla")
        {
            aps.scopeRange *= 3;
        } else if (inRange.length > 2)
        {
            aps.scopeRange *= 2;
        }
    };
	collectorAPS.prototype.getGoodToGoSources = function(aps, potSources)
    {
        var goodToGo = [];
        for (var i = 0; i < potSources.length; i++)
        {
            // check if enough resources are there
            var tPlanet = vgap.planetAt(potSources[i].x, potSources[i].y);
            var curETA = aps.getETA(tPlanet);
            //console.log("...ETA to " + tPlanet.id + " -> " + curETA);
            var futRes = aps.getFutureSurfaceResources(tPlanet, curETA);
            //console.log("... potential target's " + tPlanet.id + " future resources ");
            //console.log(futRes);
            //
            var tValue = 0;
            if (this.ooiPriority == "all")
            {
                var baseDef = aps.getBaseDeficiency();
                if (baseDef)
                {
                    if (baseDef.dur > 0 || baseDef.tri > 0 || baseDef.mol > 0)
                    {
                        // toDo: look for source that can satisfy the need
                        if (baseDef.dur + baseDef.tri + baseDef.mol > aps.hull.cargo)
                        {
                            // if deficiency exceeds cargo capacity...
                        } else
                        {
                            // if in theory the deficiency can be satisfied...
                            if (baseDef.dur > futRes.duranium || baseDef.tri > futRes.tritanium || baseDef.mol > futRes.molybdenum)
                            {
                                // reject if one deficiency can't be satisfied
                                console.log("...removing destinations: " + tPlanet.id + " due to lack of objects (" + baseDef.dur > futRes.duranium + " / " + baseDef.tri > futRes.tritanium + " / " + baseDef.mol > futRes.molybdenum + ")!");
                                continue;
                            }
                        }
                    }
                }
                tValue = futRes.buildRes;
            } else if (this.ooiPriority == "dur" || this.ooiPriority == "tri" || this.ooiPriority == "mol")
            {
                tValue = futRes[aps.moveables[this.ooiPriority]];
            } else
            {
                tValue = aps.getObjectExcess(tPlanet); // toDo: use amount of arrival time!
            }
            if (tValue < this.devideThresh)
            {
                console.log("...removing destinations: " + tPlanet.id + " due to lack of objects (" + tValue + " / " + this.devideThresh + ")!");
                continue;
            }
            potSources[i].mcs = tPlanet.megacredits;
            potSources[i].value = tValue;
            potSources[i].eta = curETA;
            goodToGo.push(potSources[i]);
        }
        return goodToGo;
    };
	collectorAPS.prototype.setSources = function(aps)
	{
	    // toDo: decide which strategy to use
        //  -> scopeRange: the range for source selection is defined by how many collectors are active within a range of the base
        //  - fixedRange: the range is fixed for each base (e.g. 2-turn radius)
		this.setScopeRange(aps);
		var sortBy = "value";
		if (this.ooiPriority == "all")
        {
            var baseDef = aps.getBaseDeficiency();
            if (baseDef)
            {
                if (baseDef.dur + baseDef.tri + baseDef.mol == 0)
                {
                    sortBy = "mcs";
                }
            } else
            {
                sortBy = "mcs";
            }
        }
        var targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.scopeRange);
        if (targetsInRange.length > 0)
        {
            targetsInRange = this.getGoodToGoSources(aps, targetsInRange);
        }
        console.log("... potential targets: " + targetsInRange.length);
        var potential = [];
		for (var i = 0; i < targetsInRange.length; i++)
		{
			var tPlanet = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
			//if (tPlanet.x == aps.ship.x && tPlanet.y == aps.ship.y) continue;
            //var tValue = aps.getObjectExcess(tPlanet);
			var distance = Math.ceil(autopilot.getDistance( {x: tPlanet.x, y: tPlanet.y}, {x:aps.ship.x ,y:aps.ship.y} ));
            //console.log("...ETA to " + tPlanet.id + " -> " + eta);
            potential.push( { x: tPlanet.x, y: tPlanet.y, pid: tPlanet.id, value: targetsInRange[i].value, mcs: targetsInRange[i].mcs, distance: distance, eta: targetsInRange[i].eta } );
		}
		this.sources = aps.clusterSortCollection(potential, "eta", sortBy, "desc");
        //this.sources = autopilot.sortCollection(potential, "distance");
	};
    collectorAPS.prototype.setSecondaryDestination = function(aps)
    {

    };
    collectorAPS.prototype.setPotentialWaypoints = function(aps)
    {
        aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    };
	collectorAPS.prototype.setPotentialDestinations = function(aps)
	{
		console.log("Determine potential destinations...");
		// by planet.id sorted sinks (deficiencies)
		if (this.sinks.length === 0) this.setSinks(aps);
		// by planet.id sorted sources (two piles -high/low value- by distance)
		if (this.sources.length === 0) this.setSources(aps);
		//
		if (aps.atBase)
		{
			// if we are at base (sink), set sources as potential destinations
			console.log("...for collector at base (sink)...");
			aps.potDest = this.sources;
		} else
		{
			// set base as only potential destination, if we are at a source
			console.log("...for collector at a (source) planet...");
			aps.potDest = this.sinks;
		}
		if (aps.potDest.length === 0)
		{
			console.log("setPotentialDestinations: no destinations available...");
		} else
		{
			console.log(aps.potDest);
		}
	};
    collectorAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        var filteredDest = [];
        console.log("...filtering collector destinations: " + aps.potDest.length);
        for (var i = 0; i < aps.potDest.length; i++)
        {
            if (aps.potDest[i].pid != aps.base.id)
            {
                var potPlanet = vgap.getPlanet(aps.potDest[i].pid);
                var willBeBase = (potPlanet.note && potPlanet.note.body.match(/nup:base/));
                var isHub = (potPlanet.note && potPlanet.note.body.match(/nup:hub/));
                if (willBeBase) // don't use (other) prospected starbase planets
                {
                    console.log("...removing destinations: " + potPlanet.id + " - a starbase will be built here!");
                    continue;
                }
                // if potential destination is the base of another APS
                if (aps.isAPSbase(potPlanet.id))
                {
                    var starbase = vgap.getStarbase(potPlanet.id);
                    if (starbase && this.ooiPriority != "cla")
                    {
                        console.log("...removing destination " + potPlanet.id + " as we do not collect from other bases with starbase");
                        continue;
                    }
                    // the base is employing APS of the same type (collector with priority x)
                    if (aps.baseHasSameAPStype(potPlanet.id, "col", this.ooiPriority))
                    {
                        console.log("...(NOT) removing destination " + potPlanet.id + " due to collector mission conflict");
                        //continue; toDo: disabled to allow building of "collector chains", collectors as "concentrators"
                    }
                }
            }
            filteredDest.push(aps.potDest[i]);
        }
        aps.potDest = filteredDest;
    };
	collectorAPS.prototype.handleCargo = function (aps) // called on arrival at destination and when at owned planet
	{
		if (aps.planet && aps.isOwnPlanet)
		{
			if (aps.atBase) // we are at base (sink)
			{
				aps.unloadCargo();
				if (this.ooiPriority == "neu") aps.unloadFuel();
			} else // source or waypoint
			{
				var transCargo = this.loadCargo(aps);
				console.log("Cargo summary: " + transCargo);
			}
		}
	};
	collectorAPS.prototype.loadCargo = function(aps)
	{
        var curCargo = 0;
	    if (aps.destination.id == aps.planet.id)
        {
            // Supply & MC handling
            if (this.ooiPriority == "mcs" || (this.alwaysLoadMC && this.ooiPriority != "cla"))
            {
                if (!(this.sellSupply == "notBov" && aps.planet.nativeracename == "Bovinoid"))
                {
                    aps.sellSupply();
                }
                aps.loadMegacredits(aps.planet);
            }
            // supply handling
            if (this.ooiPriority == "sup")
            {
                var sups = aps.getObjectExcess(aps.planet, "sup");
                curCargo = aps.loadObject("supplies", aps.planet, sups);
            }
            // colonist handling
            if (this.ooiPriority == "cla")
            {
                var clans = aps.getObjectExcess(aps.planet, "cla");
                curCargo = aps.loadObject("clans", aps.planet, clans);
            }
            // Resources handling
            // fuel handling
            if (this.ooiPriority == "neu")
            {
                var fuel = aps.getObjectExcess(aps.planet, "neu");
                curCargo = aps.loadObject("neutronium", aps.planet, fuel);
            }
            // mineral handling
            if (this.ooiPriority != "mcs" && this.ooiPriority != "cla")
            {
                var baseSequence = [];
                var loadingSequence = [];
                if (this.ooiPriority == "all")
                {
                    baseSequence = [ { res: "dur", value: parseInt(aps.base.duranium) }, { res: "tri", value: parseInt(aps.base.tritanium) }, { res: "mol", value: parseInt(aps.base.molybdenum) } ];
                } else if (this.ooiPriority == "dur")
                {
                    loadingSequence = ["duranium"];
                    baseSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "tri", value: parseInt(aps.base.tritanium) } ];
                } else if (this.ooiPriority == "tri")
                {
                    loadingSequence = ["tritanium"];
                    baseSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
                } else if (this.ooiPriority == "mol")
                {
                    loadingSequence = ["molybdenum"];
                    baseSequence = [ { res: "tri", value: parseInt(aps.base.tritanium) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
                }
                // determine the (remaining) loading sequence by what is needed at base (sink)
                baseSequence = autopilot.sortCollection(baseSequence, "value", "asc");
                baseSequence.forEach(function(seq){ loadingSequence.push(aps.moveables[seq.res]); });
                // load in sequence
                for (var i = 0; i < loadingSequence.length; i++)
                {
                    curCargo += aps.loadObject(loadingSequence[i], aps.planet);
                    if (curCargo == aps.hull.cargo) break;
                }
            }
        } else
        {
            var hasBase = vgap.getStarbase(aps.planet.id);
            if (!hasBase)
            {
                var mcValue = aps.getObjectExcess(aps.planet, "mcs");
                if (mcValue > 50)
                {
                    aps.loadMegacredits(aps.planet, (mcValue - 50));
                }
            }
        }
		return curCargo;
	};
	/*
	 *
	 * Autopilot - Distributor Module
	 *      - destination is always a sink
	 *      - if current planet or ship does not hold the required resources, a secondary destination is selected and approached first
	 *      - will approach sink, if cargo holds sufficient material
	 */
	function distributorAPS()
	{
		this.minimalCargoRatioToGo = 0.25; // in percent of cargo capacity (e.g. 0.7 = 70%)
        this.turnRangeAmp = 1;
        this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
		this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
		this.ooiPriority = "cla"; // object of interest (ooi) priority = "all" (=dur, tri, mol), "dur", "tri", "mol", "mcs", "sup", "cla"
		this.alwaysLoadMC = true; // freighter missions will always include MCs
		this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
		this.supplyRetentionAmount = 150; // if selling supplies, we keep some for other purposes
		this.fuelRetentionMass = 500;
		this.mcRetentionAmount = 100;
		this.enemySafetyZone = 81; // radius of each enemy planet and ship that will be avoided by us (planets in that range are not used as targets)
		// fixed to ship porperties
		this.devideThresh = 0;
		// data container
		this.frnnSources = [];
		this.sources = [];
		this.frnnSinks = [];
		this.sinks = [];
	}
	distributorAPS.prototype.getPotentialSinks = function(aps)
    {
        if (aps.objectOfInterest == "cla")
        {
            return autopilot.clanDeficiencies;

        } else if (aps.objectOfInterest == "neu")
        {
            return autopilot.neuDeficiencies;
        } else if (aps.objectOfInterest == "sup")
        {
            return autopilot.supDeficiencies;

        } else if (aps.objectOfInterest == "mcs")
        {
            return autopilot.mcDeficiencies;
        }
        return false;
    };
	distributorAPS.prototype.setSinks = function(aps)
	{
	    var potSinks = this.getPotentialSinks(aps);
        //console.log(potSinks);
	    var splitBy = "deficiency";
	    var sortBy = "distance";
	    var direction = "asc";
	    var cutOff = 0; // to differentiate between marginal sinks and true sinks
        var capacity = aps.hull.cargo;
        var minResolveFactor = 0.75;
		if (this.ooiPriority == "cla")
		{
            splitBy = "government";
            cutOff = -50;
			this.devideThresh = 5;
		} else if (this.ooiPriority == "neu")
		{
            //this.devideThresh = 50;
            cutOff = -50; // only consider deficiencies of 50 and more
            capacity = aps.hull.fueltank;
            if (aps.ship.hullid == 96) // = cobol class research
            {
                cutOff = 1000;
                direction = "desc";
                if (potSinks.length < 1)
                {
                    potSinks = autopilot.frnnOwnPlanets;
                }
            }
		} else if (this.ooiPriority == "sup")
		{
            minResolveFactor = 0.33;
            splitBy = "resources";
			this.devideThresh = 4000; // toDo: average of all planets?
		} else if (this.ooiPriority == "mcs")
        {
            capacity = 10000;
            splitBy = "resources";
            cutOff = -100; // only consider deficiencies of 100 and more
            this.devideThresh = 4000; // toDo: average of all planets?
        }
        var trueSinks = [];
		for (var i = 0; i < potSinks.length; i++)
		{
			var sinkPlanet = vgap.getPlanet(potSinks[i].pid);
			var distance = Math.floor(autopilot.getDistance({x: sinkPlanet.x, y: sinkPlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			var def = this.getObjectDeficiency(sinkPlanet);
			if (def < cutOff && capacity >= def * -minResolveFactor) // at least 75% of the deficiency should be resolved by the APS
			{
                potSinks[i].deficiency = def;
                potSinks[i].distance = distance;
                trueSinks.push(potSinks[i]);
            }
		}
		// priorities by degree of deficiency (split)... and sort splits by distance
		this.sinks = aps.getDevidedCollection(trueSinks, splitBy, this.devideThresh, sortBy, direction);
		console.log(this.sinks);
	};
	distributorAPS.prototype.getObjectDeficiency = function(object, ooi)
    {
        if (typeof ooi == "undefined") ooi = this.ooiPriority;
        if (ooi == "cla")
        {
            return autopilot.getClanDeficiency(object);
        } else if (ooi == "neu")
        {
            return autopilot.getFuelDeficiency(object);
        } else if (ooi == "sup")
        {
            return autopilot.getSupDeficiency(object);
        } else if (ooi == "mcs")
        {
            return autopilot.getMcDeficiency(object);
        }
        return false;
    };
	distributorAPS.prototype.getCutOffBySinkDeficiency = function(planet)
    {
        if (this.ooiPriority == "cla")
        {
            return autopilot.getClanDeficiency(planet);
        } else if (this.ooiPriority == "neu")
        {
            return autopilot.getFuelDeficiency(planet);
        } else if (this.ooiPriority == "sup")
        {
            return autopilot.getSupDeficiency(planet);
        } else if (this.ooiPriority == "mcs")
        {
            return autopilot.getMcDeficiency(planet);
        }
        return false;
    };
	distributorAPS.prototype.getPotentialSources = function()
    {
        if (this.ooiPriority == "cla")
        {
            return autopilot.clanSources;
        } else if (this.ooiPriority == "neu")
        {
            return autopilot.neuSources;
        } else if (this.ooiPriority == "sup")
        {
            return autopilot.supSources;
        } else if (this.ooiPriority == "mcs")
        {
            return autopilot.mcSources;
        }
        return false;
    };
	distributorAPS.prototype.isSource = function(planet)
	{
        return (this.getObjectDeficiency(planet) > 0);
	};
	distributorAPS.prototype.getSpecificSources = function(aps)
    {
        var destDef = Math.floor(this.getObjectDeficiency(aps.destination) * 1.2);
        var needed = (destDef * -1) - aps.ship[aps.moveables[this.ooiPriority]];
        console.log("...needs " + this.ooiPriority + ":" + needed);
        var fSources = []; // filtered specific (satisfy deficiency) sources
        for (var i = 0; i < autopilot.frnnOwnPlanets.length; i++)
        {
            var cP = vgap.getPlanet(autopilot.frnnOwnPlanets[i].pid);
            if (cP.id == aps.destination.id) continue; // exclude destination
            var value = aps.getObjectExcess(cP);
            if ((value >= needed || value >= aps.hull.cargo) && !aps.planetIsSourceOfCollector(cP.id))
            {
                autopilot.frnnOwnPlanets[i].pid = cP.id;
                autopilot.frnnOwnPlanets[i].value = value;
                // use distance between destination and source, so we can approach that which is closer to the sink!
                autopilot.frnnOwnPlanets[i].distance = Math.floor(autopilot.getDistance( {x: aps.destination.x, y: aps.destination.y}, {x: cP.x, y: cP.y} ));
                fSources.push(autopilot.frnnOwnPlanets[i]);
            }
        }
        if (fSources.length > 0)
        {
            console.log("...found specific source(s)!");
            if (fSources.length > 1)
            {
                fSources.sort(function(a, b) {
                    var x = a.distance;
                    var y = b.distance;
                    if (x < y) {return -1;}
                    if (x > y) {return 1;}
                    return 0;
                });
            }
            console.log(fSources);
        }
        return fSources;
    };
	distributorAPS.prototype.setSecondaryDestination = function(aps)
    {
        // check if cargo contains the required amount for sink (destination)
        var destDef = this.getObjectDeficiency(aps.destination);
        var cargoHoldsDef = (aps.ship[aps.moveables[this.ooiPriority]] >= (destDef * -1) || aps.ship[aps.moveables[this.ooiPriority]] == aps.hull.cargo);
        var planetHoldsDef = false;
        if (aps.planet)
        {
            var plExcess = aps.getObjectExcess(aps.planet);
            planetHoldsDef = (plExcess >= (destDef * -1));
        }
        if (!cargoHoldsDef && !planetHoldsDef)
        {
            console.log("...insufficient cargo!");
            // we are lacking something, set closest source as secondary destination
            // - only planets that are not destination of another aps that will pickup material we need
            var potSources = this.getSpecificSources(aps);
            if (potSources.length > 0)
            {
                aps.secondaryDestination = vgap.getPlanet(potSources[0].pid);
                console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
            } else {
                console.log("...couldn't find a secondary destination");
                // continue to destination, loading as much as there is on the way...
                // toDo: consider the next best as secondary destination ?
            }
        }
    };
    distributorAPS.prototype.setPotentialWaypoints = function(aps)
    {
        aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    };
	distributorAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (this.sinks.length === 0) this.setSinks(aps);
		if (this.sinks.length < 1)
		{
			console.warn("[" + aps.ship.id + "] - no potential destinations available!");
			aps.isIdle = true;
		} else {
            aps.potDest = this.sinks;
            aps.isIdle = false;
        }
        aps.updateStoredData();
	};
    distributorAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        var filteredDest = [];
        console.log("...filtering distributor destinations: " + aps.potDest.length);
        for (var i = 0; i < aps.potDest.length; i++)
        {
            // in case another distributor is already serving the destination, exclude
            var conflictAPS = aps.destinationHasSameAPStype(aps.potDest[i].pid); // returns stored data for APS that also visit potPlanet with the same mission
            if (conflictAPS)
            {
                console.log("...deficiency of planet " + aps.potDest[i].pid + " already a mission");
                continue;
            }
            filteredDest.push(aps.potDest[i]);
        }
        aps.potDest = filteredDest;
    };
    distributorAPS.prototype.satisfyLocalDeficiency = function(aps)
    {
        if (aps.objectOfInterest == "neu") // test with fuel only
        {
            // is there another distributor on its way, to satisfy the deficiency?
            if (!aps.planetIsSinkOfDistributor(aps.planet.id))
            {
                var localDef = this.getObjectDeficiency(aps.planet) * -1;
                //console.log("...local deficiency (" + this.ooiPriority + "):" + localDef);
                if (localDef > 0)
                {
                    aps.unloadObject(aps.moveables[aps.objectOfInterest], aps.planet, localDef);
                }
            }
        }
    };
	distributorAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet && aps.isOwnPlanet)
		{
			var transCargo = 0;
            if (aps.destination.id == aps.planet.id) // unload cargo when at destination
            {
                aps.unloadCargo();
                aps.unloadFuel();
            } else // unload at the current planet, if deficiency exists at current planet
            {
                this.satisfyLocalDeficiency(aps);
            }
			if (this.isSource(aps.planet))
			{
				transCargo = this.loadCargo(aps); // load cargo
			}
			console.log("Cargo summary: " + transCargo);
		}
	};
	distributorAPS.prototype.loadCargo = function(aps)
	{
	    if (aps.destination)
        {
            var transCargo = 0;
            var dP = vgap.getPlanet(aps.destination.id);
            var factor = 1.2;
            if (this.ooiPriority == "neu") factor = 1.5;
            var deficiency = Math.floor(this.getObjectDeficiency(dP) * factor); // bring more...
            var thisObj = aps.moveables[this.ooiPriority];
            if (deficiency < 0 && aps.ship[thisObj] < (deficiency * -1))
            {
                var excess = aps.getObjectExcess(aps.planet);
                if ((deficiency * -1) > excess) deficiency = (excess * -1);
                console.log("...satisfying (" + aps.moveables[this.ooiPriority] + ") ooi-deficiency: " + (deficiency * -1));
                transCargo = aps.loadObject(aps.moveables[this.ooiPriority], aps.planet, (deficiency * -1));
            }
            var otherCargo = aps.satisfyOtherDeficiencies(aps.planet);
            return (transCargo + otherCargo);
        }
	};
	/*
     *  Container for local storage data entries
     */
    function APSdata(data)
    {
        this.sid = data.sid;
        this.base = data.base;
        this.shipFunction = data.shipFunction;
        this.ooiPriority = data.ooiPriority;
        this.destination = data.destination;
        this.secondaryDestination = data.secondaryDestination;
        this.newFunction = data.newFunction;
        this.newOoiPriority = data.ooiPriority;
        this.idle = data.idle;

        // set defaults (not already set in data)
        if (typeof this.destination == "undefined") this.destination = false;
        if (typeof this.secondaryDestination == "undefined") this.secondaryDestination = false;
        if (typeof this.newFunction == "undefined") this.newFunction = false;
        if (typeof this.newOoiPriority == "undefined") this.newOoiPriority = false;
        if (typeof this.idle == "undefined") this.idle = false;
    }
    APSdata.prototype.getData = function()
    {
        // mandatory fields
        if (typeof this.sid == "undefined") return false;
        if (typeof this.base == "undefined") return false;
        if (typeof this.shipFunction == "undefined") return false;
        return {
            sid: this.sid,
            base: this.base,
            shipFunction: this.shipFunction,
            ooiPriority: this.ooiPriority,
            destination: this.destination,
            secondaryDestination: this.secondaryDestination,
            newFunction: this.newFunction,
            newOoiPriority: this.newOoiPriority,
            idle: this.idle
        };
    };
    /*
     *  Container for local configuration data entries
     */
    function APSSettings(setup)
    {
        this.debug = false;
        if (typeof setup.debug != "undefined") this.debug = setup.debug;
    }
    APSSettings.prototype.getSettings = function()
    {
        return {
            debug: this.debug
        };
    };
	/*
     *
     *  Auto Pilot Ship (APS) Object
     *
     *
     *    Required
     *    -
     *    -
     *    Optional:
     *    -
     *    -
     *    -
     */
	function APS(ship, cfgData)
	{
		if (typeof ship == "undefined") return;
		this.ship = ship;
		this.hull = false;
		this.isAPS = false;
		this.isIdle = false;
		this.idleReason = [];
		this.fFactor = 0;
		this.fuelFactor = {
			t1: [0,100,800,2700,6400,12500,21600,34300,51200,72900],
			t2: [0,100,430,2700,6400,12500,21600,34300,51200,72900],
			t3: [0,100,425,970,5400,12500,21600,34300,51200,72900],
			t4: [0,100,415,940,1700,7500,11600,24300,31200,72900],
			t5: [0,100,415,940,1700,2600,10500,14300,23450,72900],
			t6: [0,100,415,940,1700,2600,3733,12300,21450,72900],
			t7: [0,100,415,940,1700,2600,3733,5300,19450,42900],
			t8: [0,100,400,900,1600,2500,3600,5000,7000,42900],
			t9: [0,100,400,900,1600,2500,3600,4900,6400,8100]
		};
		this.gravitonic = false;
		this.radiationShielding = false;
        this.enemySafetyZone = 81;
		this.scopeRange = 200;

		this.simpleRange = 81; // warp 9 max turn distance
		this.maxRange = 160; // adjusted by maxRange
		this.defaultFixedRadius = 160; // adjusted by maxRange (=50 %)

		this.planet = false; // current planet (if at any)
        this.isOwnPlanet = false;
		this.base = false; // base -> planet object
        this.atBase = false; // bool
        this.inWarpWell = false; // bool
        this.waypoint = false; // holds planet object if target is a planet
        this.destination = false; // destination -> planet object
        this.secondaryDestination = false; // secondary destination -> planet object
        this.atDestination = false; // bool
		//
        this.storedData = false; // stored data of APS
        this.apcBaseIds = [];
        this.apcDestinations = [];
        this.apcByBase = {};
        this.apcByDest = {};
        this.apcBySecDest = {};
        this.apcByShip = {};
		this.primaryFunction = false;
		this.objectOfInterest = false;
		this.functionModule = {};
		this.hasToSetPotDes = false;
		this.deficiencies = [ "cla", "neu", "sup", "mcs" ];
		this.shipFunctions = {
			col: "collector",
			dis: "distributor",
            exp: "expander",
            alc: "alchemy"
		};
		this.moveables = {
			neu: "neutronium",
			dur: "duranium",
			tri: "tritanium",
			mol: "molybdenum",
			sup: "supplies",
			mcs: "megacredits",
			cla: "clans"
		};
		this.noteColor = "ff9900";
		this.potentialWaypoints = []; // potential next targets
		this.potDest = []; // potential destinations
		//
		if (typeof cfgData != "undefined" && cfgData !== false)
		{
		    this.storedData = cfgData;
			// null, base planet id, primary function, object of interest
            var apsConfig = [ null, cfgData.base, cfgData.shipFunction, cfgData.ooiPriority ];
			if (apsConfig)
			{
				this.isAPS = true;
				this.initAPScontrol();
				this.initializeBoardComputer(apsConfig);
			} else
			{
				this.isAPS = false;
			}
		} else
		{
			// not an APS
			this.isAPS = false;
		}
	}
	APS.prototype.bootFunctionModule = function(func)
	{
		if (func == "col")
		{
			console.log("...Collector Mode");
			this.functionModule = new collectorAPS(this);
		} else if (func == "dis")
		{
			console.log("...Distributer Mode");
			this.functionModule = new distributorAPS(this);
		} else if (func == "alc")
		{
			console.log("...Alchemy Mode");
			this.functionModule = new alchemyAPS(this);
		} else if (func == "exp")
		{
			console.log("...Expander Mode");
			this.functionModule = new expanderAPS(this);
		} else
		{
			this.isAPS = false;
		}
	};
	APS.prototype.initAPScontrol = function()
    {
        var apsData = autopilot.loadGameData();
        for (var i = 0; i < apsData.length; i++)
        {
            if (apsData[i].sid != this.ship.id)
            {
                this.apcBaseIds.push(apsData[i].base);
                if (apsData[i].destination) this.apcDestinations.push(apsData[i].destination);
                //
                if (typeof this.apcByBase[apsData[i].base] == "undefined") this.apcByBase[apsData[i].base] = [];
                this.apcByBase[apsData[i].base].push({
                    sid: apsData[i].sid,
                    destination: apsData[i].destination,
                    secondaryDestination: apsData[i].secondaryDestination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle
                });
                if (typeof this.apcByDest[apsData[i].destination] == "undefined") this.apcByDest[apsData[i].destination] = [];
                this.apcByDest[apsData[i].destination].push({
                    sid: apsData[i].sid,
                    base: apsData[i].base,
                    secondaryDestination: apsData[i].secondaryDestination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle
                });
                if (typeof this.apcBySecDest[apsData[i].secondaryDestination] == "undefined") this.apcBySecDest[apsData[i].secondaryDestination] = [];
                this.apcBySecDest[apsData[i].secondaryDestination].push({
                    sid: apsData[i].sid,
                    base: apsData[i].base,
                    destination: apsData[i].destination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle
                });
                if (typeof this.apcByShip[apsData[i].sid] == "undefined") this.apcByShip[apsData[i].sid] = [];
                this.apcByShip[apsData[i].sid].push({
                    base: apsData[i].base,
                    destination: apsData[i].destination,
                    secondaryDestination: apsData[i].secondaryDestination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle
                });
            }
        }
        //console.log("APC By Base");
        //console.log(this.apcByBase);
    };
	APS.prototype.initializeBoardComputer = function(configuration)
	{
		console.error("Initializing flight computer of APC " + this.ship.id);
		//
		var cfgFunction = configuration[2]; // primary function
		this.primaryFunction = cfgFunction;
		var cfgOoiPriority = configuration[3]; // object of interest
		this.objectOfInterest = cfgOoiPriority;
		//
		// this.ship (set by constructor)
		//
		this.hull = vgap.getHull(this.ship.hullid);
		this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp]; // currently applicable fuel factor
		if (this.hull.special && this.hull.special.match(/Gravitonic/)) this.gravitonic = true;
		if (this.hull.special && this.hull.special.match(/Radiation Shielding/)) this.radiationShielding = true;
		this.setRange(); // simple- and max-range AND defaultFixedRadius (1/2 max-range)
		//
		// current position
		//
        this.planet = vgap.planetAt(this.ship.x, this.ship.y); // note: planetAt returns planet, even if the exact position is in warp well!
        this.inWarpWell = this.isInWarpWell({ x: this.ship.x,y: this.ship.y });
        if (this.inWarpWell) this.planet = false;
        //if (this.planet && this.planet.ownerid != vgap.player.id && cfgFunction != "exp") this.planet = false; // we don't want to interact (yet) with planets not owned by us
        this.isOwnPlanet = (this.planet && this.planet.ownerid == vgap.player.id);
        //
		var cfgBase = parseInt(configuration[1]); // base planet id
		this.base = vgap.getPlanet(cfgBase);
		if (this.planet && this.planet.id == this.base.id) this.atBase = true; // are we at our base of operation
		// summary of user supplied ship configuration (don't provide destination, it will be set from storage)
		var cfgData = { sid: this.ship.id, base: cfgBase, shipFunction: cfgFunction, ooiPriority: cfgOoiPriority };
		// local storage data
		var storageData = autopilot.syncLocalStorage(cfgData);
		if (storageData === false || typeof storageData == "undefined") return; // if false is returned, APS has been deactivated and entry in local storage deleted
		console.log(storageData);
		if (!this.isValidDestination(storageData.destination)) storageData.destination = false; // e.g. is destination (still) our planet
		//
		// initialize ship function module
		//
        if (!this.isValidDestination(storageData.secondaryDestination)) storageData.secondaryDestination = false; // e.g. is destination (still) our planet
        //
        // initialize ship function module
        //
		this.bootFunctionModule(cfgFunction);
		//
		this.functionModule.devideThresh = this.getDevisionThresh();
		this.functionModule.ooiPriority = cfgOoiPriority; // toDo: remove, only use this.objectOfInterest

        if (storageData.destination)
        {
            this.destination = vgap.getPlanet(storageData.destination);
            if (storageData.secondaryDestination)
            {
                this.secondaryDestination = vgap.getPlanet(storageData.secondaryDestination);
            }
            if (this.planet)
            {
                console.log("...at planet with destination (" + storageData.destination + ") set.");
                console.log("...2nd destination: " + this.secondaryDestination);
                // if we are at the destination, clear destination setting
                if (this.planet.id == this.destination.id)
                {
                    console.log("...planet is destination, handle cargo.");
                    this.functionModule.handleCargo(this);
                    console.log("...clear destination.");
                    this.destination = false;
                    this.secondaryDestination = false;
                    storageData.destination = false;
                    storageData.idle = false;
                    storageData.secondaryDestination = false;
                    // if new behaviour is requested, now is the time for change
                    if (storageData.newFunction !== false)
                    {
                        storageData.shipFunction = storageData.newFunction;
                        storageData.newFunction = false;
                    }
                    if (storageData.newOoiPriority !== false)
                    {
                        storageData.ooiPriority = storageData.newOoiPriority;
                        storageData.newOoiPriority = false;
                    }
                    this.storedData = autopilot.syncLocalStorage(storageData);
                    this.hasToSetPotDes = true; // will determine potDest, select destination and set next target
                    console.log("...scheduled for potential destination determination.");
                } else if (this.secondaryDestination && this.planet.id == this.secondaryDestination.id)
                {
                    console.log("...planet is 2nd destination, handle cargo.");
                    this.functionModule.handleCargo(this);
                    console.log("...clear 2nd destination.");
                    this.secondaryDestination = false;
                    storageData.secondaryDestination = false;
                    this.storedData = autopilot.syncLocalStorage(storageData);
                    console.log("...setting next Target.");
                    this.setShipTarget(this.destination);
                } else
                {
                    console.log("...planet is NOT destination.");
                    if (this.planet.id == this.base.id)
                    {
                        console.log("...planet is base.");
                        this.hasToSetPotDes = true;  // will determine potDest, select destination and set next target
                        console.log("...scheduled for potential destination determination.");
                    } else {
                        //
                        console.log("...setting next Target.");
                        this.setShipTarget(this.destination);
                    }
                }
            } else
            {
                console.log("...in space / warp-well with destination (" + storageData.destination + ") set.");
                //
                // we are in space
                //
                if (this.targetIsSet())
                {
                    // target set
                    var wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
                    if (wpP) this.waypoint = wpP;
                } else {
                    // no target is set...
                    console.log("...setting next Target.");
                    this.setShipTarget(this.destination);
                }
            }
        } else
        {
            console.log("...no destination set.");
            console.log("...scheduled for potential destination determination.");
            this.hasToSetPotDes = true;  // will determine potDest, select destination and set next target
        }
	};
    /*
     * By having the information of how many APS are operating within the same area
     * we can set the scope range of those collectors: the more, the greater the scope range (area with potential destinations)
     * By having the information of how many APS are operating within the same area
     * we can filter new potential mission destinations to avoid "clustering" of APS
     */
	APS.prototype.getAPSinRange = function(range)
    {
        var center = {};
        if (this.shipFunction == "col")
        {
            center = { x: this.base.x, y: this.base.y };
        } else
        {
            center = { x: this.ship.x, y: this.ship.y };
        }
        var lStorage = autopilot.loadGameData();
        if (lStorage)
        {
            var frnnPositions = [];
            var pids = [];
            var sids = [];
            for(var i = 0; i < lStorage.length; i++)
            {
                // for collectors we need all APS operating from the same base
                if (this.shipFunction == "col" && lStorage[i].shipFunction == this.primaryFunction && lStorage[i].base == this.base)
                {
                    if (lStorage[i].ooiPriority == "all" || this.objectOfInterest == lStorage[i].ooiPriority)
                    {
                        pids.push(lStorage[i].base);
                    }
                } else
                {
                    sids.push(lStorage[i].sid);
                }
            }
            if (pids.length > 0)
            {
                frnnPositions = this.getPositions4Planets(pids); // base IDs -> planet coordinates
            } else if (sids.length > 0)
            {
                frnnPositions = this.getPositions4Ships(sids); // ship IDs -> ship coordinates
            }
            return this.getTargetsInRange(frnnPositions, center.x, center.y, range);
        }
    };
	/*
	 *  object information
	 */

    APS.prototype.isAPSbase = function(pid)
    {
        if (this.apcBaseIds.indexOf(pid) > -1) return true;
        return false;
    };
    APS.prototype.planetIsSinkOfDistributor = function(pid, ooi) // planet is sink of another functionally equal distributor APS
    {
        console.log("... is planet sink of another distributor? " + this.apcByDest[pid]);
        if (typeof this.apcByDest[pid] == "undefined") return false; // no APS registered for destination
        if (typeof ooi == "undefined") ooi = this.objectOfInterest;
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid == this.ship.id) continue;
            if (this.apcByDest[pid][i].shipFunction == "dis" && this.apcByDest[pid][i].ooiPriority == ooi) return true;
        }
        return false;
    };
    APS.prototype.planetIsSourceOfDistributor = function(pid)
    {
        if (typeof this.apcBySecDest[pid] == "undefined") return false;
        for (var i = 0; i < this.apcBySecDest[pid].length; i++)
        {
            if (this.apcBySecDest[pid][i].sid == this.ship.id) continue;
            if (this.apcBySecDest[pid][i].shipFunction == "dis") return true;
        }
        return false;
    };
    APS.prototype.planetIsSourceOfCollector = function(pid, ooi)
    {
        if (typeof this.apcByDest[pid] == "undefined") return false;
        if (typeof ooi == "undefined") ooi = this.objectOfInterest;
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid == this.ship.id) continue; // skip current APS data
            if (this.apcByDest[pid][i].base == pid) continue; // skip APS with their base as destination -> pid is a sink
            if (this.apcByDest[pid][i].shipFunction == "col" && (this.apcByDest[pid][i].ooiPriority == "all" || this.apcByDest[pid][i].ooiPriority == ooi)) return true;
        }
        return false;
    };
    APS.prototype.destinationHasSameAPStype = function(pid, sf, ooi)
    {
        if (typeof this.apcByDest[pid] == "undefined") return false;
        if (typeof sf == "undefined") sf = this.primaryFunction;
        if (typeof ooi == "undefined") ooi = this.objectOfInterest;
        var conflictAPS = [];
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid == this.ship.id) continue;
            if (this.apcByDest[pid][i].shipFunction == sf)
            {
                if (ooi == "dur" || ooi == "tri" || ooi == "mol")
                {
                    if (this.apcByDest[pid][i].ooiPriority == "all" || this.apcByDest[pid][i].ooiPriority == ooi) conflictAPS.push(this.apcByDest[pid][i]);
                } else
                {
                    if (this.apcByDest[pid][i].ooiPriority == ooi) conflictAPS.push(this.apcByDest[pid][i]);
                }
            }
        }
        if (conflictAPS.length > 0) return conflictAPS;
        return false;
    };
    APS.prototype.baseHasSameAPStype = function(pid, sf, ooi)
    {
        if (typeof this.apcByBase[pid] == "undefined") return false;
        if (typeof sf == "undefined") sf = this.primaryFunction;
        if (typeof ooi == "undefined") ooi = this.objectOfInterest;
        for (var i = 0; i < this.apcByBase[pid].length; i++)
        {
            if (this.apcByBase[pid][i].sid == this.ship.id) continue;
            if (this.apcByBase[pid][i].shipFunction == sf)
            {
                if (ooi == "dur" || ooi == "tri" || ooi == "mol")
                {
                    if (this.apcByBase[pid][i].ooiPriority == "all" || this.apcByBase[pid][i].ooiPriority == ooi) return true;
                } else
                {
                    if (this.apcByBase[pid][i].ooiPriority == ooi) return true;
                }
            }
        }
        return false;
    };
    APS.prototype.curTargetIsNotOurs = function()
    {
        var tP = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (tP) return (tP.ownerid != vgap.player.id);
        return true;
    };
    APS.prototype.isDangerousIonStorm = function(iStorm)
    {
        return (this.getIonStormClass(iStorm) == "dangerous" || this.getIonStormClass(iStorm) == "very dangerous");
    };
    APS.prototype.getIonStormClass = function(iStorm)
    {
        var futureVoltage = iStorm.voltage;
        if (iStorm.isgrowing) futureVoltage = Math.floor(futureVoltage * 1.2);
        if (futureVoltage < 50) { return "harmless" }
        else if (futureVoltage >= 50 && futureVoltage < 100) { return "moderate" }
        else if (futureVoltage >= 100 && futureVoltage < 150) { return "strong" }
        else if (futureVoltage >= 150 && futureVoltage < 200) { return "dangerous" }
        else if (futureVoltage >= 200) { return "very dangerous" }
        return false;
    };
    APS.prototype.objectGuarded = function(object)
    {
        var ships = vgap.shipsAt(object.x, object.y);
        if (ships.length > 0)
        {
            for (var i = 0; i < ships.length; i++)
            {
                var cH = vgap.getHull(ships[i].hullid);
                // toDo: primary enemy set? kill mission set?
                if (cH.mass >= 150 && ships[i].beams > 0 && (ships[i].torps > 0 || ships[i].bays > 0) && ships[i].ammo > 0)
                {
                    return true;
                }
                //console.log(ships[i]);
            }
        }
        return false;
    };
    APS.prototype.objectInRangeOfEnemyShip = function(object)
    {
        var eS = this.getObjectsInRangeOf(autopilot.frnnEnemyShips, this.enemySafetyZone, object);
        // avoid planets in close proximity of enemy planets
        for (var j = 0; j < eS.length; j++)
        {
            // only when ship has weapons toDo: or when ship is capable of robbing?
            if (eS[j].armed)
            {
                //console.log("...position (" + object.id + ":" + object.x + "x" + object.y + ") is in range (" + this.enemySafetyZone + " lj) of enemy ship - (" + eS[j].x + "x" + eS[j].y + ")!");
                return true;
            }
        }
        return false;
    };
    APS.prototype.objectInRangeOfEnemyPlanet = function (object)
    {
        var eP = this.getObjectsInRangeOf(autopilot.frnnEnemyPlanets, this.enemySafetyZone, object);
        return (eP.length > 0);
    };
    APS.prototype.objectInRangeOfEnemy = function(object)
    {
        return (this.objectInRangeOfEnemyPlanet(object) || this.objectInRangeOfEnemyShip(object));
    };
    APS.prototype.shipInWarpWellOfPlanet = function(tP)
    {
        var distance = Math.ceil(autopilot.getDistance( {x: this.ship.x, y: this.ship.y}, {x: tP.x, y: tP.y} ));
        return (distance <= 3);
    };
    APS.prototype.getBaseDeficiency = function()
    {
        // if a starbase exists at base planet, and its primary function is ship production
        // toDo: check note for keyword, that indicates the base is used for fortification
        var sb = vgap.getStarbase(this.base.id);
        if (sb)
        {
            // techlevel upgrade cost (mcs)
            var enginetechDef = autopilot.getTechDeficiency(sb.enginetechlevel);
            var hulltechDef = autopilot.getTechDeficiency(sb.hulltechlevel);
            var beamtechDef = autopilot.getTechDeficiency(sb.beamtechlevel);
            var torptechDef = autopilot.getTechDeficiency(sb.torptechlevel);
            var mcsDef = (enginetechDef + hulltechDef + beamtechDef + torptechDef);
            // ship production cost (minerals)
            var durDef = 0;
            var triDef = 0;
            var molDef = 0;
            if (sb.enginetechlevel == 10 && sb.hulltechlevel > 9)
            {
                // set required minerals for capital ship production
                if (sb.beamtechlevel > 4 && (vgap.player.raceid == 10 || vgap.player.raceid == 11)) // rebels (10), colonies (11)
                {
                    // carrier production
                } else if (sb.beamtechlevel > 4 && sb.torptechlevel > 4 && (vgap.player.raceid == 1 || vgap.player.raceid == 3))  // fed (1), birds (3)
                {
                    // torp race
                }
            } else if (sb.enginetechlevel == 10 && sb.hulltechlevel > 5)
            {
                // set required minerals for LDSF, medium ship production
                mcsDef = 760;
                durDef = 117;
                triDef = 13;
                molDef = 78;
                // toDo: add tranquilly, patriot cost for rebells & colonies
                // toDo: add resolute cost for birds
            } else if (sb.enginetechlevel == 10 && sb.hulltechlevel > 2)
            {
                // set required minerals for MDSF + NFC production
                mcsDef = 365 + 620;
                durDef = 20 + 42;
                triDef = 7 + 8;
                molDef = 41 + 90;
                // toDo: add cobol class research (colos)
            }
            return { mcs: mcsDef, dur: durDef, tri: triDef, mol: molDef };
        }
        return false;
    };
	/*
	 *  positional information
	 */
	APS.prototype.objectInside = function(object, inside)
    {
        // toDo: replace objectInsideMinefield/Starcluster/Ionstorm
        if (typeof object == "undefined") return false;
        if (inside == "friendly")
        {
            mf = autopilot.frnnFriendlyMinefields;
        } else if (inside == "enemy")
        {
            mf = autopilot.frnnEnemyMinefields;
        } else if (inside == "web")
        {
            mf = autopilot.frnnWebMinefields;
        }
        for (var i = 0; i < mf.length; i++)
        {
            var curDistToMinefieldCenter = Math.floor(autopilot.getDistance({x: mf[i].x, y: mf[i].y}, {x: object.x, y: object.y}));
            if (mf[i].radius > curDistToMinefieldCenter) return true;
        }
        return false;
    };
	APS.prototype.objectCloseTo = function(object, closeTo)
    {
        // toDo: replace objectInsideMinefield/Ionstorm (non-strict)
    };
	APS.prototype.objectInsideMineField = function(object, friendly, strict)
    {
        if (typeof object == "undefined") return false;
        if (typeof friendly == "undefined") friendly = false;
        if (typeof strict == "undefined") strict = true;
        var mf = [];
        if (friendly)
        {
            mf = autopilot.frnnFriendlyMinefields;
        } else
        {
            mf = autopilot.frnnEnemyMinefields;
        }
        for (var i = 0; i < mf.length; i++)
        {
            var curDistToMinefieldCenter = Math.floor(autopilot.getDistance({x: mf[i].x, y: mf[i].y}, {x: object.x, y: object.y}));
            if (strict) // only true if we are INSIDE minefield
            {
                if (mf[i].radius > curDistToMinefieldCenter)
                {
                    if (friendly)
                    {
                        //console.log("Object (" + object.name + ") inside friendly minefield.");
                    }
                    return true;
                }
            } else // non-strict, also true if we are too close to a minefield
            {
                if (mf[i].radius > curDistToMinefieldCenter || (curDistToMinefieldCenter - mf[i].radius) < Math.floor(this.simpleRange / 2)) return true;
            }
        }
        return false;
    };
    APS.prototype.objectInsideStarCluster = function(object)
    {
        if (typeof object == "undefined") return false;
        var sc = autopilot.frnnStarClusters;

        for (var i = 0; i < sc.length; i++)
        {
            var curDistToStarClusterCenter = Math.floor(autopilot.getDistance({x: sc[i].x, y: sc[i].y}, {x: object.x, y: object.y}));
            var radiationradius = Math.sqrt(sc[i].mass);
            if (radiationradius > curDistToStarClusterCenter)
            {
                console.log("...object (" + object.name + ") inside radiation zone of starcluster.");
                return true;
            }
        }
        return false;
    };
    APS.prototype.objectInsideIonStorm = function(object, strict)
    {
        if (typeof object == "undefined") return false;
        if (typeof strict == "undefined") strict = true;
        var ionStorms = vgap.ionstorms;
        for (var i = 0; i < ionStorms.length; i++)
        {
            var curDistToIonStormCenter = Math.floor(autopilot.getDistance({x: ionStorms[i].x, y: ionStorms[i].y}, {x: object.x, y: object.y}));
            // toDo: consider distance next turn
            if (strict) // only true if object is INSIDE ionstorm
            {
                if (ionStorms[i].radius > curDistToIonStormCenter) return ionStorms[i];
            } else // non-strict, also true if we are too close to the ionstorm
            {
                // toDo: check heading of storm and consider heading of ship
                if (ionStorms[i].radius > curDistToIonStormCenter || (curDistToIonStormCenter - ionStorms[i].radius) < Math.pow(ionStorms[i].warp,2)) return ionStorms[i];
            }
        }
        return false;
    };
    APS.prototype.isInWarpWell = function(coords)
    {
        if (typeof coords == "undefined") coords = { x: this.ship.x, y: this.ship.y };
        var planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        var cP = autopilot.getClosestPlanet(coords);
        if (cP)
        {
            var distToShip = Math.ceil(autopilot.getDistance( { x: cP.planet.x, y: cP.planet.y }, coords));
            //console.log(distToShip);
            if (distToShip > 3) return false; // if there is no planet within 3 lj, we are not in warp well
            // <= 3 lj distance between planet and ship -> within warp well
            return true;
        } else {
            console.error("...no closest planet found???");
            return false;
        }
    };
    APS.prototype.getPositions4Ships = function(sids)
    {
        var frnnPositions = [];
        for(var i = 0; i < sids.length; i++)
        {
            var s = vgap.getShip(sids[i]);
            if (s) frnnPositions.push( { x: s.x , y: s.y } );
        }
        return frnnPositions;
    };
    APS.prototype.getPositions4Planets = function(pids)
    {
        var frnnPositions = [];
        for(var i = 0; i < pids.length; i++)
        {
            var p = vgap.getPlanet(pids[i]);
            frnnPositions.push( { x: p.x , y: p.y } );
        }
        return frnnPositions;
    };
    APS.prototype.isSafePosition = function(coords)
    {
        // ion storms
        var ionStorm = this.objectInsideIonStorm(coords);
        if (ionStorm && Math.floor(ionStorm.voltage * 1.2) > 150) // will react earlier (* 1.2)
        {
            console.log("...position is inside ~dangerous ion storm!");
            return false;
        }
        // starclusters
        var radiation = this.objectInsideStarCluster(coords);
        if (radiation)
        {
            if (!this.radiationShielding)
            {
                console.log("...position is inside starcluster radiation zone!");
                return false;
            }
        }
        // mine fields
        var WithinMinefield = this.objectInsideMineField(coords, false, true);
        if (WithinMinefield) // don't visit positions in enemy minefields
        {
            console.log("...position is inside minefield!");
            return false;
        }
        var protectedByMinefield = this.objectInsideMineField(coords, true, true);

        // enemy (ships & planets)
        if (this.objectInRangeOfEnemy(coords))
        {
            console.log("...position is close to enemy!");
            if (this.objectGuarded(coords) || (protectedByMinefield && !WithinMinefield))
            {
                console.log("...position is guarded by warship or protected by minefield.");
            } else
            {
                return false;
            }
        }
        return true;
    };
    APS.prototype.isSavePlanet = function(planet)
    {
        return this.isSafePosition(planet);
    };
    /*
     *  filter & order
     */
	APS.prototype.clusterSortCollection = function(collection, cluster, order, direction)
    {
        // default sorting - from low to high (ascending)
        if (typeof direction == "undefined") direction = "asc";
        // get unique categories
        var categories = [];
        for (var i = 0; i < collection.length; i++)
        {
            if (categories.indexOf(collection[i][cluster]) === -1)
            {
                categories.push(collection[i][cluster]);
            }
        }
        // sort categories ascending by "cluster"
        categories.sort(function(a, b) {
            return a - b;
        });
        //console.log("Collection clustering by " + categories.length + " categories.");
        //console.log(categories);
        //
        var newCollection = [];
        // put data in clusters, sort clusters by value and concatenate clusters
        for (var j = 0; j < categories.length; j++)
        {
            var clusterCollection = [];
            for (var k = 0; k < collection.length; k++)
            {
                //console.log("Category = " + categories[j] + " - collection category value = " + collection[k][cluster]);
                if (categories[j] == collection[k][cluster])
                {
                    clusterCollection.push(collection[k]);
                }
            }
            if (clusterCollection.length > 0)
            {
                if (clusterCollection.length > 1)
                {
                    clusterCollection = autopilot.sortCollection(clusterCollection, order, direction);
                }
                if (newCollection.length > 0)
                {
                    newCollection = newCollection.concat(clusterCollection);
                } else
                {
                    newCollection = clusterCollection;
                }
            }
        }
        console.log("clustered Collection:");
        console.log(newCollection);
        return newCollection;
    };
    APS.prototype.getOptimalCollection = function(collection, devisor, thresh, order, direction)
    {
        var min = 0.9;
        var max = 1.1;
        //
        var pileA = [];
        var pileB = [];
        // default sorting by distance
        if (typeof order == "undefined") order = "distance";
        // default sorting - from low to high (ascending)
        if (typeof direction == "undefined") direction = "asc";
        //
        //console.log("Splitting the collection at " + thresh);
        for(var i = 0; i < collection.length; i++)
        {
            //console.log("Value = " + collection[i][devisor]);
            if ((collection[i][devisor] * -1) > (thresh * min) && (collection[i][devisor] * -1) < (thresh * max))
            {
                pileA.push(collection[i]);
            } else
            {
                pileB.push(collection[i]);
            }
        }
        if (pileA.length == 0)
        {
            return false;
        } else
        {
            pileA = autopilot.sortCollection(pileA, order, direction);
            pileB = autopilot.sortCollection(pileB, order, direction);
            return [].concat(pileA, pileB);
        }
    };
    APS.prototype.getDevidedCollection = function(collection, devisor, thresh, order, direction)
    {
        var pileA = [];
        var pileB = [];
        // default sorting by distance
        if (typeof order == "undefined") order = "distance";
        // default sorting - from low to high (ascending)
        if (typeof direction == "undefined") direction = "asc";
        //
        //console.log("Splitting the collection at " + thresh);
        for(var i = 0; i < collection.length; i++)
        {
            //console.log("Value = " + collection[i][devisor]);
            if ((collection[i][devisor] * -1) > thresh)
            {
                pileA.push(collection[i]);
            } else
            {
                pileB.push(collection[i]);
            }
        }
        pileA = autopilot.sortCollection(pileA, order, direction);
        pileB = autopilot.sortCollection(pileB, order, direction);
        return [].concat(pileA, pileB);
    };
    APS.prototype.getDevisionThresh = function()
    {
        var devideThresh = 0;
        if (this.primaryFunction == "exp")
        {
            devideThresh = Math.floor(0.75 * this.hull.cargo);
        } else
        {
            if (this.objectOfInterest == "neu")
            {
                devideThresh = Math.floor(this.hull.fueltank * this.functionModule.minimalCargoRatioToGo);
            } else if (this.objectOfInterest == "mcs")
            {
                devideThresh = 250;
            } else
            {
                devideThresh = Math.floor(this.hull.cargo * this.functionModule.minimalCargoRatioToGo);
            }
        }
        return devideThresh;
    };
    /*
     *  movement
     */
    APS.prototype.estimateNextFuelConsumption = function(tP)
    {
        var dP = this.destination;
        if (this.secondaryDestination) dP = this.secondaryDestination;
        var curDistance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: this.ship.x, y: this.ship.y }));
        var thisFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, [], curDistance);
        var nextFuel = 0;
        this.setWaypoints(tP, dP);
        var nWP = this.getNextWaypoint(dP);
        if (nWP)
        {
            var distance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: nWP.x, y: nWP.y }));
            var nextCargo = this.estimateMissionCargo(tP);
            if (nextCargo[0] > thisFuel) nextCargo[0] -= thisFuel; // reduce cargo by fuel that is used up traveling to tP
            nextFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, nextCargo, distance);
        }
        console.log("...nextFuel estimation: " + nextFuel);
        return nextFuel;
    };
    APS.prototype.getRouteETA = function(dP)
    {
        if (typeof dP == "undefined") dP = this.destination;
        var wpIds = []; // planet Ids of waypoints
        var ETA = 0; // route ETA
        var ship = { x: this.ship.x, y: this.ship.y }; // current ship position, starting point for route
        var target = true;
        //
        while(wpIds.indexOf(dP.id) === -1 && target)    // as long as destination has not been included in the route... && target is not false....
        {
            this.setWaypoints(ship, dP);
            target = this.getNextWaypoint(dP);
            if (target)
            {
                wpIds.push(target.id); // save waypoint planet id
                ETA += this.getETA(dP, ship); // save ETA to last waypoint
                ship = { x: target.x, y: target.y }; // set next waypoint as new starting point for route calculation
            }
        }
        console.log("..." + ETA + " turns to destination indirectly.");
        return ETA;
    };
    APS.prototype.getETA = function( dest, origin )
    {
        var warp = this.ship.engineid;
        if (typeof origin === "undefined") origin = { x: this.ship.x, y: this.ship.y };
        if (typeof dest === "undefined") dest = { x: this.ship.targetx, y: this.ship.targety };
        if (!this.shipPathIsSave(dest, origin))
        {
            warp = 4;
        }
        var ETA = 1;
        var maxTurnDist = Math.pow(warp,2);
        var journeyDist = Math.floor(autopilot.getDistance({ x: origin.x, y: origin.y }, { x: dest.x, y: dest.y }));
        if (journeyDist > maxTurnDist) ETA = Math.ceil(journeyDist / maxTurnDist);
        return ETA;
    };
    APS.prototype.checkFuel = function()
    {
        this.setWarp(); // set warp factor according to current circumstances
        var fuel = Math.floor(autopilot.getOptimalFuelConsumptionEstimate(this.ship.id) * 1.1); // use more to be more flexible
        if (fuel <= parseInt(this.ship.neutronium)) return true; // if there is enough, we don't need to load fuel
        console.log("...checkFuel: currently needed: " + fuel);
        //
        // provide basic fuel backup for (empty) return trip from unowned planet..
        var backFuel = 0;
        if (this.curTargetIsNotOurs())
        {
            backFuel = fuel;
            console.log("...checkFuel: additional need: " + fuel);
        }
        fuel += backFuel;
        //
        // get the amount of fuel we need to take with us in case the next waypoint does not offer enough fuel...
        var tP = vgap.planetAt(this.ship.x, this.ship.y);
        if (tP)
        {
            var nextFuel = this.estimateNextFuelConsumption(tP);
            if (nextFuel > tP.neutronium)
                fuel += (nextFuel - tP.neutronium);
            console.log("...checkFuel: needed at next waypoint: " + nextFuel + " (" + fuel + ")");
        }
        //
        var diff = fuel - this.ship.neutronium;
        console.log("...checkFuel: ship has " + this.ship.neutronium + ", need additional " + diff);
        var loadedFuel = 0;
        if (this.planet && this.isOwnPlanet) // only load if we are in orbit around one of our planets
        {
            loadedFuel = this.loadObject("neutronium", this.planet, diff); // returns amount on board after loading
        }
        if (loadedFuel >= fuel || this.ship.hullid == 14)
        {
            return true;
        } else
        {
            this.setWarp(0);
            this.isIdle = true;
            if (this.idleReason.indexOf("fuel") == -1) this.idleReason.push("fuel");
            return false;
        }
    };
    APS.prototype.setWarp = function(warp)
    {
        this.ship.warp = 0;
        if (typeof warp == "undefined")
        {
            this.ship.warp = this.ship.engineid;
        } else
        {
            this.ship.warp = warp;
        }
        if (this.targetIsSet())
        {
            // reduce speed to warp 4, if we are currently inside a minefield
            if (this.objectInsideMineField( {x: this.ship.x, y: this.ship.y}, false, true ) && this.ship.engineid > 4) this.ship.warp = 4;
            // reduce speed to warp 3, if we are currently inside a web minefield
            if (this.objectInside( {x: this.ship.x, y: this.ship.y}, "web" ) && this.ship.engineid > 3) this.ship.warp = 3;
            // set warp 1 if we are moving into or inside warp well
            if (this.isInWarpWell({x: this.ship.targetx, y: this.ship.targety})) this.ship.warp = 1;
        }
        // update fuelFactor
        this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp];
    };
    APS.prototype.targetIsSet = function()
    {
        return (this.ship.x != this.ship.targetx || this.ship.y != this.ship.targety);
    };
    APS.prototype.escapeToWarpWell = function()
    {
        if (this.isInWarpWell())
        {
            console.log("We are in warp well...");
            this.isIdle = true;
            this.updateStoredData();
            // toDo: do we have to move? are there enemy ships close by?
        } else {
            console.log("Moving into warp well...");
            this.isIdle = false;
            var coords = this.getRandomWarpWellEntryPosition();
            this.ship.targetx = coords.x;
            this.ship.targety = coords.y;
            this.setWarp(1);
        }
    };
    APS.prototype.shipPathIsSave = function(tP, oP)
    {
        // toDo: get minefields centered within a range of the current position; range = distance to travel???
        if (typeof oP == "undefined") oP = this.ship;
        var sx1 = oP.x;
        var sy1 = oP.y;
        var sx2 = tP.x;
        var sy2 = tP.y;
        for (var i = 0; i < autopilot.frnnEnemyMinefields.length; i++)
        {
            var mF = autopilot.frnnEnemyMinefields[i];
            if (this.shipPathIntersectsObject(sx1, sy1, sx2, sy2, mF.x, mF.y, mF.radius))
            {
                console.log("...path intersects with enemy minefield!");
                return false;
            }
        }
        return true;
    };
    APS.prototype.shipPathIntersectsObject = function(sx1, sy1, sx2, sy2, ox, oy, or)
    {
        var dx = sx2 - sx1;
        var dy = sy2 - sy1;
        var dr = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
        //console.log([sx1, sy1, sx2, sy2, ox, oy, or]);
        //console.log(Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)));
        //console.log(Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)) <= or);
        return (Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)) <= or);
    };
    /*
     *  waypoint selection specifics
     */
    APS.prototype.setShipTarget = function(dP)
    {
        if (!this.secondaryDestination) this.functionModule.setSecondaryDestination(this);
        if (this.secondaryDestination) dP = this.secondaryDestination;
        console.log("...searching waypoints to " + dP.name + " (" + dP.id + ").");
        this.setWaypoints(this.ship, dP);
        var target = this.getNextWaypoint(dP);
        if (target)
        {
            this.ship.targetx = target.x;
            this.ship.targety = target.y;
            var wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
        }
    };
    APS.prototype.setWaypoints = function(ship, dP)
    {
        this.functionModule.setPotentialWaypoints(this);
        var ship2dest = Math.ceil(autopilot.getDistance( {x: ship.x , y: ship.y}, {x: dP.x , y: dP.y} ));
        var waypoints = this.getTargetsInRange(this.potentialWaypoints, dP.x, dP.y, ship2dest);
        waypoints.push({ x: dP.x, y: dP.y }); // toDo: necessary?
        var fWPs = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            var cP = vgap.planetAt(waypoints[i].x, waypoints[i].y);
            var etaDist = Math.ceil(autopilot.getDistance( {x: cP.x , y: cP.y}, {x: ship.x , y: ship.y} ));
            var cP2dPDist = Math.ceil(autopilot.getDistance( {x: cP.x , y: cP.y}, {x: dP.x , y: dP.y} ));
            waypoints[i].pid = cP.id;
            waypoints[i].ship2wPDist = etaDist;
            waypoints[i].wayp2dPDist = cP2dPDist;
            waypoints[i].ship2dPDist = ship2dest;
            waypoints[i].ship2wP2dPDist = etaDist + cP2dPDist;
            waypoints[i].wpETA = Math.ceil(etaDist / Math.pow(this.ship.engineid, 2)) + Math.ceil(cP2dPDist / Math.pow(this.ship.engineid, 2));
            // if distance between waypoint and ship is greater than the distance between destination and ship, skip
            if (ship2dest < etaDist || etaDist == 0) continue;
            fWPs.push(waypoints[i]);
        }
        console.log("...raw waypoints:");
        console.log(fWPs);
        this.potentialWaypoints = fWPs;
    };
    APS.prototype.destinationAmongWaypoints = function(dP, pW)
    {
        for (var i = 0; i < pW.length; i++)
        {
            if (pW.pid == dP.id) return true;
        }
        return false;
    };
    APS.prototype.getUrgentWaypoints = function(dP)
    {
        var waypoints = this.potentialWaypoints;
        var dDist = autopilot.getDistance( {x: this.ship.x , y: this.ship.y}, {x: dP.x , y: dP.y} );
        dDist -= 3; // warpWell
        var dETA = Math.ceil(dDist / Math.pow(this.ship.engineid, 2));
        //console.log("...direct ETA: " + dETA + " (" + dDist + ")");
        var uWPs = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            //console.log("...waypoint ETA: " + waypoints[i].wpETA + " (" + waypoints[i].ship2wP2dPDist + ")");
            if (waypoints[i].wpETA <= (dETA + 1)) uWPs.push(waypoints[i]);
        }
        uWPs = this.clusterSortCollection(uWPs, "wpETA", "wayp2dPDist");
        //uWPs = autopilot.sortCollection(uWPs, "wpETA");
        return uWPs;
    };
    APS.prototype.getWaypointsByEta = function()
    {
        var waypoints = this.potentialWaypoints;
        var wpByEta = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            var eta = Math.ceil(waypoints[i].ship2wPDist / Math.pow(this.ship.engineid, 2));
            if (eta == 0) continue;
            // toDo: merge the first two categories (e.g. 1+2 or 1+3 or 2+3...)?
            if (typeof wpByEta[eta] == "undefined")
            {
                wpByEta[eta] = [waypoints[i]];
            } else {
                wpByEta[eta].push(waypoints[i]);
            }
        }
        for (var j = 0; j < wpByEta.length; i++)
        {
            if (typeof wpByEta[j] != "undefined")
            {
                wpByEta[j] = autopilot.sortCollection(wpByEta[i], "ship2wP2dPDist");
            }
        }
        console.log("...waypoints by ETA:");
        console.log(wpByEta);
        return wpByEta;
    };
    APS.prototype.getNextWaypoint = function(dP)
    {
        var target = false;
        var urgentWaypoints = this.getUrgentWaypoints(dP);
        if (urgentWaypoints.length > 0)
        {
            console.log("...found " + urgentWaypoints.length + " urgent waypoint(s).");
            console.log(urgentWaypoints);
            if (this.destinationAmongWaypoints(dP, urgentWaypoints) && this.isSavePlanet(dP) && this.shipPathIsSave(dP))
            {
                console.log("...potential urgent waypoints contain destination!");
                target = this.destination;
            } else if (this.destinationAmongWaypoints(dP, urgentWaypoints)) {
                console.log("...planet not safe: " + this.isSavePlanet(dP));
                console.log("...ship path not safe: " + this.shipPathIsSave(dP));
            }
            if (!target)
            {
                for (var i = 0; i < urgentWaypoints.length; i++)
                {
                    var pW = vgap.planetAt(urgentWaypoints[i].x, urgentWaypoints[i].y);
                    if (this.isSavePlanet(pW))
                    {
                        var inWarpWell = this.shipInWarpWellOfPlanet(pW);
                        if (inWarpWell || this.shipPathIsSave(pW))
                        {
                            if (inWarpWell)
                            {
                                console.log("...return to orbit of " + pW.id);
                            } else {
                                console.log("...fly to " + pW.id);
                            }
                            target = pW; break;
                        } else
                        {
                            console.log("...ship path not safe");
                        }
                    } else {
                        console.log("...planet not safe");
                    }
                }
            }
        } else {
            target = this.getEtaWaypoint(dP);
        }
        return target;
    };
    APS.prototype.getEtaWaypoint = function(dP)
    {
        var target = false;
        var waypoints = this.getWaypointsByEta();
        var minETA = 0;
        for (var j = 1; j < 5; j++)
        {
            if (typeof waypoints[j] != "undefined")
            {
                console.log("...potential waypoints with ETA " + j);
                //waypoints[j] = this.sortCollection(waypoints[j]);
                console.log(waypoints[j]);
                if (minETA == 0)
                {
                    minETA = j; // clostest waypoints (minimal ETA)
                    if (this.destinationAmongWaypoints(dP,waypoints[j]) && this.isSavePlanet(dP) && this.shipPathIsSave(dP))
                    {
                        console.log("...potential waypoints contain destination!");
                        target = this.destination; break;
                    }
                }
                for (var i = 0; i < waypoints[j].length; i++)
                {
                    var pW = vgap.planetAt(waypoints[j][i].x, waypoints[j][i].y);
                    if (this.shipInWarpWellOfPlanet(pW) && this.isSavePlanet(pW))
                    {
                        console.log("...return in orbit of " + pW.id);
                        target = pW; break;
                    } else if (this.isSavePlanet(pW) && this.shipPathIsSave(pW))
                    {
                        console.log("...fly to " + pW.id);
                        target = pW; break;
                    }
                }
            }
            if (target) break;
        }
        return target;
    };
    /*
     *  general tools
     */
    APS.prototype.getObjectsInRangeOf = function(objects, range, of)
    {
        var objectsInRange = [];
        for (var j = 0; j < objects.length; j++)
        {
            var dist = Math.floor(autopilot.getDistance({x: objects[j].x, y: objects[j].y}, {x: of.x, y: of.y}));
            if (dist <= range)
            {
                objectsInRange.push(objects[j]);
                //console.log("...");
            }
        }
        return objectsInRange;
    };
	APS.prototype.getFutureSurfaceResources = function(planet, turns)
	{
		if (typeof turns == "undefined") turns = 1;
		//
		var factories = parseInt(planet.factories);
		var supplies = parseInt(planet.supplies);
		//
		var actNeu = planet.neutronium + this.getMiningOutput(planet, "neutronium", turns);
		var actDur = planet.duranium + this.getMiningOutput(planet, "duranium", turns);
		var actTri = planet.tritanium + this.getMiningOutput(planet, "tritanium", turns);
		var actMol = planet.molybdenum + this.getMiningOutput(planet, "molybdenum", turns);
		//
		return {
			neutronium: actNeu,
			duranium: actDur,
			tritanium: actTri,
			molybdenum: actMol,
			supplies: (supplies + (factories * turns)),
			buildRes: (actDur + actTri + actMol)
		};
	};
	APS.prototype.getMiningOutput = function(planet, res, turns)
	{
        if (typeof turns == "undefined") turns = 1;
	    if (typeof planet == "undefined")
        {
            if (this.planet)
            {
                planet = this.planet;
            } else
            {
                return 0;
            }
        }
		var resdensity = "density" + res;
		var resground = "ground" + res;
		// toDo: lizardEffektor = ...
		var theoreticalOutput = turns * Math.floor(planet.mines * (planet[resdensity] / 100));
		if (theoreticalOutput <= planet[resground])
		{
			return parseInt(theoreticalOutput);
		} else
		{
			return parseInt(planet[resground]);
		}
	};
    APS.prototype.getTargetsInRange = function(coords, x, y, r)
    {
        var frnn = new FRNN(coords, r);
        return frnn.inRange( { x: x, y: y }, r);
    };
	/*
	 *  mission specifics
	 */
    APS.prototype.estimateMissionCargo = function(tP)
    {
        var cargo = [];
        if (this.primaryFunction == "col")
        {
            if (tP.id == this.base.id)
            {
                cargo = [ 0 ];
            } else
            {
                var available = this.getObjectExcess(tP);
                if (available > this.hull.cargo)
                {
                    cargo = [ this.hull.cargo ];
                } else {
                    cargo = [ available ];
                }
            }
        } else if (this.primaryFunction == "dis")
        {
            cargo = [ 0 ];
            if (this.secondaryDestination)
            {
                if (tP.id == this.secondaryDestination.id)
                {
                    // primary deficiency
                    var cargoSum = 0;
                    var sinkRequest = this.functionMOdule.getObjectDeficiency(this.destination) * -1;
                    var sourceValue = this.getObjectExcess(tP);
                    if (sourceValue >= sinkRequest)
                    {
                        cargoSum += sinkRequest;
                    }
                    // secondary deficiencies
                    var oDC = this.satisfyOtherDeficiencies(tP, true);
                    if (oDC > 0) cargoSum += oDC;
                    cargo = [ cargoSum ];
                } else {
                    // we will load nothing, in case we already have partial cargo...
                    cargo = []; // use current cargo
                }
            } else
            {
                if (tP.id != this.destination.id)
                {
                    // we will load nothing, but have cargo
                    cargo = []; // use current cargo
                }
            }
        }
        return cargo;
    };
	APS.prototype.evaluateMissionDestinations = function()
	{
		// function module specific filtering of potential destinations
        this.functionModule.evaluateMissionDestinations(this);
        // gerneral filtering of potential destinations (e.g. remove destinations located in problematic zones)
		var filteredDest = [];
		var avoidDest = [];
		console.log("...filtering destinations: " + this.potDest.length);
		for (var i = 0; i < this.potDest.length; i++)
		{
            var potPlanet = vgap.getPlanet(this.potDest[i].pid);
            if (potPlanet.id == this.base.id && this.isSavePlanet(potPlanet)) // our base, if save, is always a valid target
            {
                filteredDest.push(this.potDest[i]);
            } else
            {
                if (this.planet && potPlanet.id == this.planet.id && this.primaryFunction != "dis") continue; // toDo: current planet can't be a mission destination ?
                if (this.getMissionConflict(potPlanet))
                {
                    console.log("...removing destination " + potPlanet.id + " due to mission conflict...");
                    continue;
                }
                // lastly... if potential destination is unsave... add potPlanet to avoidList which will be appended to the filtered list
                if (!this.isSavePlanet(potPlanet)) // minefields, enemies, ionstorms...
                {
                    // move this potPlanet to the end of the array
                    avoidDest.push(this.potDest[i]);
                    continue;
                }
                filteredDest.push(this.potDest[i]);
            }
		}
		console.log("...remaining destinations: " + filteredDest.length);
		if (avoidDest.length > 0)
		{
			console.log("...adding avoid-destinations: " + avoidDest.length);
			if (filteredDest.length > 0)
            {
                filteredDest.concat(avoidDest);
            } else
            {
                filteredDest = avoidDest;
            }

		}
		this.potDest = filteredDest;
	};
    APS.prototype.setMissionDestination = function()
    {
        var dP = false;
        if (this.potDest.length > 0) {
            this.evaluateMissionDestinations();
            if (this.potDest.length > 0) {
                console.warn("Setting destination of APS...");
                console.log(this.potDest);
                dP = vgap.planetAt(this.potDest[0].x, this.potDest[0].y);
                this.destination = dP;
                this.updateStoredData();
            }
        }
        if (dP && (this.planet || this.isInWarpWell()))
        {
            this.setShipTarget(dP);
            this.setWarp();
        } // else idle
    };
	APS.prototype.confirmMission = function()
	{
	    //
        if (this.planet && this.isOwnPlanet) this.functionModule.handleCargo(this);
        // Do we have a target?
        if (this.targetIsSet())
        {
            console.log("...target acquired.");
            if (this.checkFuel()) {
                console.log("...checkFuel ok.");
                this.isIdle = false;
                //console.log(this.waypoint);
                if (this.waypoint && !this.isSavePlanet(this.waypoint))
                {
                    this.setWarp(0);
                    // retreat to closest planet
                    for (var i = 0; i < 10; i++)
                    {
                        var eP = autopilot.getClosestPlanet( { x: this.ship.x, y: this.ship.y }, i);
                        if (this.isSavePlanet(eP.planet))
                        {
                            this.ship.targetx = eP.planet.x;
                            this.ship.targety = eP.planet.y;
                            console.warn("...approaching standard orbit.");
                            this.setWarp();
                            this.isIdle = false;
                            break;
                        }
                    }
                }
            } else {
                console.warn("...checkfuel failed.");
                console.warn("...are we in warpwell? " + this.isInWarpWell());
                if (this.isInWarpWell())
                {
                    // try returning to planet
                    var cP = autopilot.getClosestPlanet({ x: this.ship.x, y: this.ship.y });
                    console.warn("...in warpwell around " + cP.planet.id);
                    if (cP)
                    {
                        this.ship.targetx = cP.planet.x;
                        this.ship.targety = cP.planet.y;
                        console.warn("...approaching standard orbit.");
                        this.setWarp();
                        this.isIdle = false;
                    }
                }
                if (this.planet && !this.isSavePlanet(this.planet))
                {
                    this.escapeToWarpWell();
                    this.isIdle = false;
                }
            }
        } else
        {
            if (this.destination)
            {
                console.warn("...no target acquired (idle).");
                this.isIdle = true;
                if (this.idleReason.indexOf("target") == -1) this.idleReason.push("target");
                if (this.planet && !this.isSavePlanet(this.planet))
                {
                    this.escapeToWarpWell();
                    if (this.idleReason.indexOf("unsafe") == -1) this.idleReason.push("unsafe");
                }
            } else
            {
                if (this.primaryFunction == "alc")
                {
                    this.functionModule.updateFC(this);
                } else
                {
                    this.isIdle = true;
                    if (this.idleReason.indexOf("dest") == -1) this.idleReason.push("dest");
                }
            }
        }
        this.updateStoredData();
        this.updateNote();
	};
	APS.prototype.getSumOfOOI = function(conflictAPS)
    {
        var sum = 0;
        for (var i = 0; i < conflictAPS.length; i++)
        {
           sum += autopilot.getHullCargo(conflictAPS[i].sid);
        }
        return sum;
    };
	APS.prototype.getMissionConflict = function(potPlanet)
	{
	    // todo: module specific handling
        if (potPlanet.id == this.base.id) return false; // exclude base planet from evaluation
        var conflictAPS = this.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
        if (conflictAPS)
        {
            console.log("...there are " + conflictAPS.length + " other APS visiting this location.");
            // toDo: reconsider if another APS will drop something off...
            //
            // only count as conflict if there is not enough resources available ()
            var sumOfAllCargo = this.getSumOfOOI(conflictAPS);
            if (this.objectOfInterest == "neu")
            {
                sumOfAllCargo += this.hull.fueltank; // add tank capacity of current APS
            } else {
                sumOfAllCargo += this.hull.cargo; // add hull cargo of current APS
            }
            var sumOfResources = 0;
            if (this.objectOfInterest == "all")
            {
                sumOfResources = autopilot.getSumOfSurfaceMinerals(potPlanet);
            } else {
                sumOfResources = potPlanet[this.moveables[this.objectOfInterest]];
            }
            if (sumOfAllCargo >= sumOfResources)
            {
                return true;
            }
        }
		// Check if potential destination is in the APS control list
		var storedGameData = autopilot.loadGameData();
		if (storedGameData === null)
		{
			// no storage setup yet
			console.log("Couldn't read stored game data...");
			return false;
		} else
		{
			for(var i = 0; i < storedGameData.length; i++)
			{
                if (storedGameData[i].sid == this.ship.id) continue; // skip data from current APS

                // storage APS ship object
				var curShip = vgap.getShip(storedGameData[i].sid);
				if (curShip)
				{
					// current location of storage APS
					var curShipPlanet = vgap.planetAt(curShip.x, curShip.y);
					// special case of expander.... if an expander is at an unowned planet and transferring,
                    // the planet will still be recognized as unowned and another expander will see the planet as a potential target for colonization
                    // toDo: remove those kind of planets from unownedPlanet collection
					if (curShipPlanet && curShipPlanet.id == potPlanet.id && this.primaryFunction == "exp" && !this.functionModule.isSource(potPlanet))
                    {
                        // reject
                        return true;
                    }
				}
			}
		}
		return false;
	};
	APS.prototype.updateNote = function()
	{
		var note = vgap.getNote(this.ship.id, 2);
		if (this.isAPS)
		{
			var destination = "";
			if (this.isIdle)
            {
                destination = "(IDLE:";
                if (this.idleReason.length > 0)
                {
                    destination += this.idleReason.join(",");
                }
                destination += ")";
            } else {
                if (this.destination)
                {
                    if (this.destination.id == this.base.id && this.primaryFunction == "col")
                    {
                        destination = "->home";
                    } else
                    {
                        destination = "->"+this.destination.id;
                    }
                }
            }
			var secDest = "";
			if (this.secondaryDestination)
            {
                secDest = "(" + this.secondaryDestination.id + ")";
            }
			note.body = "B|" + this.base.id + "|" + this.primaryFunction + "|" + this.objectOfInterest + " " + secDest + destination;
			note.color = this.noteColor;
		} else
		{
			note.body = " ";
            note.color = "000000";
		}
	};
	// interaction specifics
    APS.prototype.satisfyOtherDeficiencies = function (sP, simu)
    {
        if (typeof sP == "undefined") sP = this.planet; // source Planet
        if (typeof simu == "undefined") simu = false; // simu true = only simulate, do not load anything, return sum of deficiencies (except mcs)
        var finalCargo = 0;
        // try to satisfy other deficiencies
        for (var i = 0; i < this.deficiencies.length; i++)
        {
            if (this.objectOfInterest == this.deficiencies[i]) continue;
            var otherDef = Math.floor(this.functionModule.getObjectDeficiency(this.destination, this.deficiencies[i])) * -1;
            var otherExc = this.getObjectExcess(sP, this.deficiencies[i]);
            if (otherExc < otherDef) otherDef = otherExc;
            var otherObj = this.moveables[this.deficiencies[i]];
            if (otherDef > 0 && this.ship[otherObj] < otherDef)
            {
                if (this.ship[otherObj] > 0) otherDef -= this.ship[otherObj]; // reduce deficiency by what is already onboard
                console.log("...satisfying other (" + otherObj + ") deficiency :" + otherDef);
                if (otherObj != "megacredits") finalCargo += otherDef;
                if (!simu) this.loadObject(otherObj, sP, otherDef);
            }
        }
        return finalCargo;
    };
	APS.prototype.unloadFuel = function()
	{
		if (this.planet && this.isOwnPlanet)
		{
			var amount = parseInt(this.ship.neutronium);
			if (amount > 1) amount -= 1;
			var onShip = this.unloadObject("neutronium", this.planet, amount);
		}
	};
	APS.prototype.unloadCargo = function()
	{
        var onShip = this.hull.cargo - this.getCargoCapacity();
        if (this.primaryFunction == "exp")
        {
            this.functionModule.transferCargo(this);
        } else if (this.planet && this.isOwnPlanet)
		{
            var unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
            for (var i = 0; i < unloadingSequence.length; i++)
            {
                var cargo = unloadingSequence[i];
                onShip = this.unloadObject(cargo, this.planet, parseInt(this.ship[cargo]));
            }
		}
        console.log("[" + this.ship.id + "]-| unloadCargo: " + onShip);
	};
	APS.prototype.loadMegacredits = function(from, amount)
	{
		if (typeof amount == "undefined") amount = from.megacredits;
		if (from.megacredits >= amount)
		{
			if (amount + this.ship.megacredits > 10000)
			{
				from.megacredits -= (10000 - this.ship.megacredits);
				this.ship.megacredits = 10000;
			} else
			{
				this.ship.megacredits += amount;
				from.megacredits -= amount;
			}
		} else
		{
			if (from.megacredits + this.ship.megacredits > 10000)
			{
				from.megacredits -= (10000 - this.ship.megacredits);
				this.ship.megacredits = 10000;
			} else
			{
				this.ship.megacredits += from.megacredits;
				from.megacredits = 0;
			}
		}
		from.changed = 1;
	};
	APS.prototype.unloadObject = function(object, to, amount)
	{
		var actAmount = amount;
		if (typeof amount == "undefined") amount = this.ship[object];
        // ...amount is more than what is available, then only unload the latter amount
        if (amount > this.ship[object]) amount = this.ship[object];
		// now unload, planets have unlimited cpacity... no need to check
		this.ship[object] -= amount;
		to[object] += amount;
		to.changed = 1;
		return this.ship[object];
	};
	APS.prototype.transferObject = function(object, to, amount)
	{
		var actAmount = 0;
		if (typeof amount == "undefined") {
			// if amount is not defined, unload all
			actAmount = this.ship[object];
		} else {
			// if it is defined use it, unless...
			actAmount = amount;
			// ...amount is more than what is available, then only unload the latter amount
			if (amount > this.ship[object]) actAmount = this.ship[object];
		}
		// now set to transfer, planets have unlimited cpacity... no need to check
		this.ship[object] -= actAmount;
		this.ship["transfer" + object] += actAmount;
		this.ship.transfertargetid = to.id;
		this.ship.transfertargettype = 1; // planet; toDo: detect if ship-to-ship (2) or ship-to-planet (1)
		to.changed = 1;
		// return actAmount;
		return this.ship[object];
	};
	APS.prototype.loadObject = function(object, from, amount)
	{
		var curCapacity = 0;
		var actAmount = 0;
		// if object is neutronium, use tankcapacity to calculate curCapacity
		if (object == "neutronium")
		{
			curCapacity = this.getFuelCapacity();
		} else if (object == "megacredits")
		{
			curCapacity = 10000;
		} else
		{
			// if object is anything else, use cargo capacity
			curCapacity = this.getCargoCapacity();
		}

		if (typeof amount == "undefined") {
			// if amount is not defined, load all
			actAmount = from[object];
		} else
        {
            // if amount is defined and > 0
            if (amount > 0)
            {
                actAmount = amount;
                // check actual available amount
                var actExcess = this.getObjectExcess(from, object);
                if (amount > actExcess) actAmount = actExcess;
                // toDo: this appears to be redundant
                if (from[object] < actAmount) actAmount = from[object];
            } else {
                return this.ship[object];
            }
		}
		// now check ship specs
		if (curCapacity >= actAmount)
		{
			this.ship[object] += parseInt(actAmount);
			from[object] -= parseInt(actAmount);
			this.ship.changed = 1;
			from.changed = 1;
			// return actAmount;
		} else
		{
			this.ship[object] += curCapacity;
			from[object] -= curCapacity;
			this.ship.changed = 1;
			from.changed = 1;
			// return curCapacity; // no more room
		}
		return this.ship[object];
	};
	APS.prototype.updateStoredData = function()
    {
        var destination = false;
        if (this.destination) destination = this.destination.id;
        var sDestination = false;
        if (this.secondaryDestination) sDestination = this.secondaryDestination.id;
        this.storedData = {
            sid: this.ship.id,
            base: this.base.id,
            destination: destination,
            secondaryDestination: sDestination,
            shipFunction: this.primaryFunction,
            ooiPriority: this.functionModule.ooiPriority,
            idle: this.isIdle
        };
        autopilot.syncLocalStorage(this.storedData);
    };
	APS.prototype.isValidDestination = function(destination)
	{
		if (destination)
		{
			var destPlanet = vgap.getPlanet(destination);
			if (destPlanet) return (destPlanet.ownerid == vgap.player.id || destPlanet.ownerid == 0);
		}
		return false;
	};
	// planet specifics
	APS.prototype.sellSupply = function()
	{
		var supplies = this.planet.supplies - this.functionModule.supplyRetentionAmount;
		if (supplies < 10) return;
		this.planet.supplies -= supplies;
		this.planet.suppliessold += supplies;
		this.planet.megacredits += supplies;
		this.planet.changed = 1;
	};
	APS.prototype.getRandomWarpWellEntryPosition = function ()
    {
        if (this.planet)
        {
            // warp well entry from planet
            var p = this.planet;
            var coords = [
                { x: p.x - 1, y: p.y + 1},
                { x: p.x, y: p.y + 1},
                { x: p.x + 1, y: p.y + 1},
                { x: p.x - 1, y: p.y},
                { x: p.x + 1, y: p.y},
                { x: p.x - 1, y: p.y - 1},
                { x: p.x, y: p.y - 1},
                { x: p.x + 1, y: p.y - 1}
            ]; // 8 positions (0-7)
            var pick = Math.floor(Math.random() * 10);
            if (pick > 7) pick = Math.floor(pick / 2);
            return coords[pick];
        } else
        {
            // toDo: warp well entry from space
            return { x: this.ship.x, y: this.ship.y };
        }
    };
    APS.prototype.getObjectExcess = function(object, ooi)
    {
        var tValue = 0;
        if (typeof ooi == "undefined")
        {
            ooi = this.objectOfInterest;
        }
        if (ooi == "all")
        {
            // amount of all resources that are used to build ships
            tValue = parseInt(object.duranium) + parseInt(object.tritanium) + parseInt(object.molybdenum);
        } else if (ooi == "cla")
        {
            // amount of available (+) clans
            tValue = autopilot.getClanDeficiency(object);
        } else if (ooi == "mcs")
        {
            // amount of megacredits
            tValue = autopilot.getMcDeficiency(object);
        } else if (ooi == "neu")
        {
            // amount of neutronium
            tValue = autopilot.getFuelDeficiency(object);
        } else if (ooi == "sup")
        {
            if (this.primaryFunction == "alc" && object.id == this.planet.id)
            {
                tValue = object.supplies - 150;
            } else {
                tValue = autopilot.getSupDeficiency(object);
            }
        } else
        {
            tValue = parseInt(object[this.moveables[ooi]]);
        }
        if (tValue < 0)
        {
            return 0;
        } else
        {
            return tValue;
        }
    };
	// Ship specifics
    APS.prototype.getFuelCapacity = function()
    {
        return (parseInt(this.hull.fueltank) - parseInt(this.ship.neutronium));
    };
    APS.prototype.getCargoCapacity = function()
    {
        var cargoCapacity = this.hull.cargo;
        var components = [
            this.ship.duranium,
            this.ship.tritanium,
            this.ship.molybdenum,
            this.ship.supplies,
            this.ship.ammo, // torpedos or fighters
            this.ship.clans
        ];
        components.forEach(function(comp) { cargoCapacity -= parseInt(comp); });
        //console.log("APS cargo capacity: " + cargoCapacity);
        return cargoCapacity;
    };
    APS.prototype.shipHasWeapons = function(ship)
    {
        var shipHull = vgap.getHull(ship.hullid);
        // toDo: the ability to rob the ship, is a weapon. So any privateer ship returns true...
        return (shipHull.beams > 0 || shipHull.fighterbays > 0 || shipHull.launchers > 0);
    };
	APS.prototype.getShipMass = function(cargo)
	{
		return autopilot.getHullCargoMass(this.ship.id, cargo);
	};
	APS.prototype.setRange = function()
	{
		this.maxRange = this.getShipRange(false, [this.hull.mass, this.hull.cargo], this.hull.fueltank);
		var amp = 1;
		if (typeof this.functionModule.turnRangeAmp != "undefined") amp = this.functionModule.turnRangeAmp;
		console.log("...engineid: " + this.ship.engineid + " amp: " + amp);
		this.simpleRange = Math.floor(Math.pow(this.ship.engineid,2) * amp); // max turn distance with max efficient warp (=engineid)
		if (this.gravitonic) this.simpleRange *= 2;
		//console.log("simple Range: " + this.simpleRange);
	};
	APS.prototype.getShipRange = function(byTurn, cargo, fuel)
	{
		var maxTurnDist = Math.pow(this.ship.warp,2);
		if (this.gravitonic) maxTurnDist *= 2;
		// if we want to know the distance we can pass each turn... maxDist is the answer
		if (byTurn) return maxTurnDist;
		// if we want to know the distance we can travel using all available fuel...
		var mass = this.getShipMass(cargo);
		if (typeof fuel == "undefined") fuel = this.ship.neutronium;
		var maxTurns = 0;
		var penalty = 0;
		//
		// we check the consumption turn by turn until the tank is empty...
		//
		while (fuel > 0)
		{
			var consumption = vgap.turnFuel(maxTurnDist, mass, this.fFactor, maxTurnDist, penalty);
			if (consumption > 0)
			{
				// reduce available fuel and consequently the mass we move
				fuel -= consumption;
				mass -= consumption;
				if (fuel >= 0) maxTurns++;
			} else
			{
				break;
			}
		}
		var range = maxTurnDist * maxTurns; // toDo: we could add the distance we can pass using the remaining fuel
		return range;
	};
	/*
     *
     * Auto Pilot Control
     *
     */
	var autopilot = {
		storage: {},
        storageId: false,
        storageCfgId: false,
        configuration: {},
		frnnPlanets: [],
		frnnOwnPlanets: [],
		frnnEnemyMinefields: [],
        frnnWebMinefields: [],
        frnnFriendlyMinefields: [],
        frnnStarClusters: [],
		frnnEnemyShips: [],
		frnnEnemyPlanets: [],
		apsLocations: [],
		apsMissions: [],
		clanDeficiencies: [],
		clanSources: [],
		neuDeficiencies: [],
		neuSources: [],
		mcDeficiencies: [],
		mcSources: [],
		fuelFactor: {
			t1: [0,100,800,2700,6400,12500,21600,34300,51200,72900],
			t2: [0,100,430,2700,6400,12500,21600,34300,51200,72900],
			t3: [0,100,425,970,5400,12500,21600,34300,51200,72900],
			t4: [0,100,415,940,1700,7500,11600,24300,31200,72900],
			t5: [0,100,415,940,1700,2600,10500,14300,23450,72900],
			t6: [0,100,415,940,1700,2600,3733,12300,21450,72900],
			t7: [0,100,415,940,1700,2600,3733,5300,19450,42900],
			t8: [0,100,400,900,1600,2500,3600,5000,7000,42900],
			t9: [0,100,400,900,1600,2500,3600,4900,6400,8100]
		},
        isChromeBrowser: false,
        realTurn: false,
        gameId: false,
        specialShipAtPlanet: function(planet, hullid)
        {
            var ships = vgap.shipsAt(planet.x, planet.y);
            if (ships.length > 0)
            {
                for (var i = 0; i < ships.length; i++)
                {
                    if (ships[i].hullid == hullid && ships[i].friendlycode != "nal") return true;
                }
            }
            return false;
        },
        alchemyAtPlanet: function(planet)
        {
            return autopilot.specialShipAtPlanet(planet, 105);
        },
        refineryAtPlanet: function(planet)
        {
            return autopilot.specialShipAtPlanet(planet, 104);
        },
		populateFrnnCollections: function()
		{
            autopilot.populateFrnnStarClusters();
			autopilot.populateFrnnPlanets();
			autopilot.populateFrnnMinefields();
			autopilot.populateFrnnShips();
		},
        populateFrnnStarClusters: function()
        {
            autopilot.frnnStarClusters = [];
            vgap.stars.forEach(function(cluster) {
                autopilot.frnnStarClusters.push({x: cluster.x, y: cluster.y, radius: cluster.radius, mass: cluster.mass, temp: cluster.temp});
            });
        },
		populateFrnnMinefields: function()
		{
			autopilot.frnnEnemyMinefields = [];
            autopilot.frnnWebMinefields = [];
			autopilot.frnnFriendlyMinefields = [];
			vgap.minefields.forEach(function(minefield) {
				if (minefield.ownerid != vgap.player.id && !autopilot.isFriendlyPlayer(minefield.ownerid))
				{
					autopilot.frnnEnemyMinefields.push({x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid});
				} else {
                    autopilot.frnnFriendlyMinefields.push({x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid});
                }
                if (minefield.isweb)
                {
                    autopilot.frnnWebMinefields.push({x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid});
                }
			});
		},
		isFriendlyPlayer: function(playerId)
		{
			for (var i = 0; i < vgap.relations.length; i++)
			{
				if (vgap.relations[i].playertoid == playerId)
				{
					return (vgap.relations[i].relationto >= 2);
				}
			}
		},
		populateFrnnShips: function()
		{
			autopilot.frnnEnemyShips = [];
			vgap.ships.forEach(function(ship) {
				// toDo: consider heading
				if (ship.ownerid != vgap.player.id && !autopilot.isFriendlyPlayer(ship.ownerid))
				{
				    var isArmed = false;
                    var shipHull = vgap.getHull(ship.hullid);
                    //console.log("Checking if ship ( " + ship.id + " ) has weapons...");
                    if (shipHull.beams > 0 || shipHull.fighterbays > 0 || shipHull.launchers > 0)
                    {
                        isArmed = true;
                    }
					autopilot.frnnEnemyShips.push({sid: ship.id, x: ship.x, y: ship.y, armed: isArmed});
				}
			});
		},
		populateFrnnPlanets: function()
		{
			autopilot.frnnEnemyPlanets = [];
			autopilot.frnnUnownedPlanets = [];
			autopilot.frnnOwnPlanets = [];
			autopilot.frnnPlanets = [];
			vgap.planets.forEach(function(planet) {
				autopilot.frnnPlanets.push({x: planet.x, y: planet.y});
				if (planet.ownerid > 0 && planet.ownerid == vgap.player.id) autopilot.frnnOwnPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
				if (planet.ownerid > 0 && planet.ownerid != vgap.player.id && !autopilot.isFriendlyPlayer(planet.ownerid))
				{
					autopilot.frnnEnemyPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
				}
				// toDo: ownerid === 0 = unowned? or also unknown owner?
				if (planet.ownerid == 0) autopilot.frnnUnownedPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
			});
		},
        getTechDeficiency: function(curTech, wantTech)
        {
            if (typeof wantTech == "undefined") wantTech = 10;
            if (typeof wantTech != "undefined" && wantTech < 2) wantTech = 2;
            var maxCost = [0, 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
            var def = 0;
            for (var i = 1; i < curTech; i++)
            {
                def += i * 100;
            }
            return (maxCost[wantTech] - def);
        },
		getMaxHappyNativeTaxRate: function(planet)
		{
			var nativeRaceBonus = planet.nativeracename == "Avian" ? 10 : 0;
			var nebulaBonus = 0; // toDo: get nebulaBonus // The Nebula Bonus is 5 if the planet is in a nebula and has less than 50 light-years visibility.
			for (var i=30; i>0; i--)
			{
				var happinessChange = (Math.round( (1000 - Math.sqrt(planet.nativeclans) - 85 * i - Math.round( (planet.mines + planet.factories) / 2 ) - 50 * (10 - planet.nativegovernment)) ) / 100) + nativeRaceBonus + nebulaBonus;
				if (happinessChange > -1)
				{
					//console.log("Optimal change in happiness: " + happinessChange);
					return i;
				}
			}
			return null;
		},
		getNativeTaxClanDeficiency: function(planet)
		{
			return (parseInt(planet.clans) - autopilot.getNativeTaxClans(planet));
		},
		getNativeTaxClans: function(planet)
		{
			// return the number of clans needed to receive all native taxes
			var maxNativeTaxRate = autopilot.getMaxHappyNativeTaxRate(planet);
			return Math.ceil(autopilot.getIncomeFromNatives(planet, maxNativeTaxRate));
		},
		getBuildingClanDeficiency: function(planet)
		{

            var mines = planet.targetmines;
            var factories = planet.targetfactories;
            var defense = planet.targetdefense;
            // use targetmines instead of mines to react to planeteer plugin behaviour
            //if (planet.targetmines > planet.mines) mines = planet.targetmines;
            //if (planet.targetfactories > planet.factories) mines = planet.targetfactories;
            //if (planet.targetdefense > planet.defense) mines = planet.targetdefense;
            var pStructures = [
                { structures: "mines", n: mines, thresh: 200 },
                { structures: "factories", n: factories, thresh: 100 },
                { structures: "defense", n: defense, thresh: 50 }
            ];
			pStructures.sort(
				function(a, b)
				{
					var x = a.n;
					var y = b.n;
					if (x < y) {return 1;}
					if (x > y) {return -1;}
					return 0;
				}
			);
			var freeClans = 0;
			var curStructures = pStructures[0].n;
			var curThresh = pStructures[0].thresh;
			//
			var extraStructures = curStructures - curThresh;
			if (extraStructures > 0)
			{
				var minimalClans = curThresh + Math.pow(extraStructures, 2);
				freeClans = planet.clans - minimalClans;
			} else
			{
				freeClans = planet.clans - curStructures;
			}
			return freeClans;
		},
        scanReports: function()
        {
            // check messages for combat reports where APS might have been destroyed...
            // this is necessary due to the recycling of shipIDs
            vgap.messages.forEach(function (msg)
            {
                //console.log(msg);
                if (msg.body.match(/has been destroyed/) !== null)
                {
                    console.warn("A ship has been destroyed...");
                    if (msg.ownerid == vgap.player.id)
                    {
                        console.warn("...the ship is from us...");
                        // if target is a APS, delete local storage entry
                        var apsData = autopilot.isInStorage(msg.target);
                        if (apsData)
                        {
                            console.warn("...the ship is an APS...");
                            apsData.action = "DEL";
                            autopilot.syncLocalStorage(apsData);
                        }
                    }
                }
            });
        },
        getHullCargo: function(sid)
        {
            var cS = vgap.getShip(sid);
            if (cS)
            {
                var hull = vgap.getHull(cS.hullid);
                return hull.cargo;
            }
            return 0;
        },
		getFreeClans: function(planet)
		{
		    var def = autopilot.getClanDeficiency(planet);
		    if (def > 0)
            {
                return def;
            }
            return 0;
		},
        getFuturePlanetResources: function(planet, turns)
        {
            if (typeof turns == "undefined") turns = 1;
            //
            var mines = parseInt(planet.mines);
            var factories = parseInt(planet.factories);
            var supplies = parseInt(planet.supplies);
            //
            var neu = parseInt(planet.neutronium);
            var gneu = parseInt(planet.groundneutronium);
            var dneu = parseInt(planet.densityneutronium);
            var theoNeu = Math.floor((dneu / 100) * mines) * turns;
            var actNeu = theoNeu + neu;
            if (theoNeu > gneu) actNeu = gneu + neu;
            //
            var dur = parseInt(planet.duranium);
            var gdur = parseInt(planet.groundduranium);
            var ddur = parseInt(planet.densityduranium);
            var theoDur = Math.floor((ddur / 100) * mines) * turns;
            var actDur = theoDur + dur;
            if (theoDur > gdur) actDur = gdur + dur;
            //
            var tri = parseInt(planet.tritanium);
            var gtri = parseInt(planet.groundtritanium);
            var dtri = parseInt(planet.densitytritanium);
            var theoTri = Math.floor((dtri / 100) * mines) * turns;
            var actTri = theoTri + tri;
            if (theoTri > gtri) actTri = gtri + tri;
            //
            var mol = parseInt(planet.molybdenum);
            var gmol = parseInt(planet.groundmolybdenum);
            var dmol = parseInt(planet.densitymolybdenum);
            var theoMol = Math.floor((dmol / 100) * mines) * turns;
            var actMol = theoMol + mol;
            if (theoMol > gmol) actMol = gmol + mol;
            //
            return {
                neutronium: actNeu,
                duranium: actDur,
                tritanium: actTri,
                molybdenum: actMol,
                supplies: (supplies + (factories * turns)),
                buildRes: (actDur + actTri + actMol)
            };
        },
        sortCollection: function(collection, order, direction)
        {
            // default sorting - from low to high (ascending)
            if (typeof direction == "undefined") direction = "asc";
            if (typeof order == "undefined") order = "distance";
            var returnIfSmaller = -1;
            var returnIfBigger = 1;
            if (direction == "desc")
            {
                // sorting from high to low
                returnIfSmaller = 1;
                returnIfBigger = -1;
            }
            return collection.sort(
                function(a, b)
                {
                    var x = a[order];
                    var y = b[order];
                    if (x < y) {return returnIfSmaller;}
                    if (x > y) {return returnIfBigger;}
                    return 0;
                }
            );
        },
        getTargetsInRange: function(coords, x, y, r)
        {
            var frnn = new FRNN(coords, r);
            return frnn.inRange( { x: x, y: y }, r);
        },
        getClosestPlanet: function(coords, candidate)
        {
            if (typeof coords == "undefined") return false;
            var planets = [];
            //console.log({ x: coords.x, y: coords.y});
            //console.log(autopilot.frnnOwnPlanets);
            var closestPlanets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 200);
            for (var i = 0; i < closestPlanets.length; i++)
            {
                var cP = vgap.getPlanet(closestPlanets[i].pid);
                var distance = Math.ceil(autopilot.getDistance( {x: cP.x, y: cP.y}, {x: coords.x ,y: coords.y} ));
                var dataEntry = { planet: cP, distance: distance };
                planets.push(dataEntry);
            }
            //console.log("...found " + planets.length + " close planets.");
            if (planets.length > 0)
            {
                var sorted = autopilot.sortCollection(planets);
                //console.log(sorted);
                if (typeof candidate == "undefined")
                {
                    return sorted[0];
                } else {
                    if (candidate > planets.length)
                    {
                        return sorted[(planets.length - 1)];
                    } else
                    {
                        return sorted[candidate];
                    }
                }
            }
            return false;
        },
        getDistance: function(p1, p2)
        {
            return Math.sqrt((Math.pow((parseInt(p1.x) - parseInt(p2.x)),2) + Math.pow((parseInt(p1.y) - parseInt(p2.y)),2)));
        },
        getHullCargoMass: function(sid, scargo)
        {
            var beamTecMass = [0,1,1,2,4,3,4,7,5,7,6];
            var torpTecMass = [0,2,2,2,4,2,2,3,2,3,3];
            var ship = vgap.getShip(sid);
            var hull = vgap.getHull(ship.hullid);
            var hullCargoMass = hull.mass;
            var maxHullCargoMass = hull.mass + hull.cargo;
            if (typeof scargo != "undefined" && scargo.length > 0)
            {
                scargo.push(ship.beams * beamTecMass[ship.beamid]);
                scargo.push(ship.torps * torpTecMass[ship.torpedoid]);
                scargo.forEach(function(comp) { hullCargoMass += parseInt(comp); });
                if (hullCargoMass > maxHullCargoMass) hullCargoMass = maxHullCargoMass;
            } else
            {
                var components = [
                    (ship.beams * beamTecMass[ship.beamid]),
                    (ship.torps * torpTecMass[ship.torpedoid]),
                    ship.duranium,
                    ship.tritanium,
                    ship.molybdenum,
                    ship.supplies,
                    ship.ammo, // torpedos or fighters
                    ship.clans
                ];
                components.forEach(function(comp) { hullCargoMass += parseInt(comp); });
            }
            return hullCargoMass;
        },
        getOptimalFuelConsumptionEstimate: function(sid, cargo, distance)
        {
            var ship = vgap.getShip(sid);
            if (typeof distance == "undefined") distance = Math.ceil(autopilot.getDistance({x: ship.x, y: ship.y}, {x: ship.targetx, y: ship.targety}));
            if (typeof cargo == "undefined") cargo = [];
            var hullCargoMass = autopilot.getHullCargoMass(sid, cargo); // without fueltank content
            var warp = ship.engineid;
            var hull = vgap.getHull(ship.hullid);
            var maxTurnDist = Math.pow(warp, 2);
            var fFactor = autopilot.fuelFactor["t" + ship.engineid][warp]; // currently applicable fuel factor
            var penalty = 0; // toDo: cloaking or some other additional fuel requirenment
            var basicConsumption = vgap.turnFuel(distance, hullCargoMass, fFactor, maxTurnDist, penalty);
            //
            var actualConsumption = vgap.turnFuel(distance, hullCargoMass + basicConsumption, fFactor, maxTurnDist, penalty);
            while (actualConsumption > basicConsumption)
            {
                basicConsumption += 1;
                if (basicConsumption > hull.fueltank) return false; // required fuel exceeds tank capacity
                actualConsumption = vgap.turnFuel(distance, hullCargoMass + basicConsumption, fFactor, maxTurnDist, penalty);
            }
            actualConsumption++;
            if (ship.hullid == 96) // = cobol class research
            {
                actualConsumption = vgap.turnFuel(maxTurnDist, hullCargoMass + basicConsumption, fFactor, maxTurnDist, penalty);
                actualConsumption++;
            }
            return actualConsumption;
        },
        getShipFuelDeficiency: function(sid, cargo, distance)
        {
            if (typeof cargo == "undefined") cargo = [];
            var fuelDef = 0;
            var ship = vgap.getShip(sid);
            var required = autopilot.getOptimalFuelConsumptionEstimate(sid, cargo, distance);
            if (required > ship.neutronium)
            {
                fuelDef = required - ship.neutronium;
                //console.log("...ship (" + ship.id + ") with fuel deficiency (" + fuelDef + ") at planet.");
            }
            return fuelDef;
        },
        getAPSatPlanet: function(planet)
        {
            var apsAt = [];
            var shipsAt = vgap.shipsAt(planet.x, planet.y);
            for (var i = 0; i < shipsAt.length; i++)
            {
                var sData = autopilot.isInStorage(shipsAt[i].id);
                if (sData) apsAt.push(sData);
            }
            return apsAt;
        },
        getNonAPSatPlanet: function(planet)
        {
            var nonAPS = [];
            var shipsAt = vgap.shipsAt(planet.x, planet.y);
            //console.log("...found " + shipsAt.length + " ships at planet...");
            for (var i = 0; i < shipsAt.length; i++)
            {
                var sData = autopilot.isInStorage(shipsAt[i].id);
                if (!sData)
                {
                    //console.log("...non-APS ship with engine " + shipsAt[i].engineid + " found...");
                    // exclude ships with low tec engines
                    if (shipsAt[i].engineid > 4)
                    {
                        nonAPS.push( shipsAt[i].id );
                    }
                }
            }
            return nonAPS;
        },
        getNonAPSfuelDeficiency: function(planet)
        {
            var fuelDef = 0;
            var closestPlanet = autopilot.getClosestPlanet( { x: planet.x, y: planet.y } );
            var distance = Math.ceil(autopilot.getDistance( { x: planet.x, y: planet.y }, { x: closestPlanet.x ,y: closestPlanet.y } ));
            var atPlanet = autopilot.getNonAPSatPlanet(planet);
            for (var i = 0; i < atPlanet.length; i++)
            {
                //console.log("...check ship (" + atPlanet[i] + ") for fuel deficiency...");
                fuelDef += autopilot.getShipFuelDeficiency(atPlanet[i], [], distance);
            }
            if (fuelDef > 0) return fuelDef;
            return false;
        },
        getIdleAPSfuelDeficiency: function(planet)
        {
            var fuelDef = 0;
            var apsAtPlanet = autopilot.getAPSatPlanet(planet);
            for (var i = 0; i < apsAtPlanet.length; i++)
            {
                if (apsAtPlanet[i].idle)
                {
                    fuelDef += autopilot.getShipFuelDeficiency(apsAtPlanet[i].sid);
                }
            }
            if (fuelDef > 0) return fuelDef;
            return false;
        },
        getClanDeficiency: function(planet, nupBase)
        {
            var natDef = 0;
            if (planet.nativeclans > 0) natDef = autopilot.getNativeTaxClanDeficiency(planet);
            var bovDef = 0;
            if (planet.nativeracename == "Bovinoid") bovDef = autopilot.getBovinoidSupClanDeficiency(planet);
            var bldDef = autopilot.getBuildingClanDeficiency(planet);
            //
            var allDef = [bldDef];
            if (natDef != 0) allDef.push(natDef);
            if (bovDef != 0) allDef.push(bovDef);
            if (allDef.length > 1)
            {
                allDef.sort(function(a, b) { return a-b; });
            }
            //console.log(planet.id);
            //console.log(allDef);
            var deficiency = allDef[0]; // use most severe deficiency
            if (nupBase)
            {
                deficiency -= 1000;
            }
            var maxPop = autopilot.getMaxColonistPopulation(planet);
            //console.log("maxPop = " + maxPop);
            if (deficiency < 0)
            {
                if ((deficiency * -1) + planet.clans > maxPop)
                {
                    deficiency = (maxPop - planet.clans) * -1;
                }
            } else {
                if (maxPop > 100)
                {
                    deficiency -= 100;
                }
            }
            return Math.floor(deficiency);
        },
		getFuelDeficiency: function(planet, turns, nupBase)
		{
		    if (typeof turns == "undefined") turns = 0;
            var fuelRetentionMass = 150; // global setting for planets
		    var sb = vgap.getStarbase(planet.id);
		    if (sb || nupBase)
            {
                fuelRetentionMass += 400;
            }
            var alchemyAtPlanet = autopilot.alchemyAtPlanet(planet);
		    if (alchemyAtPlanet)
            {
                fuelRetentionMass += 400;
            }
            var apsIdleFuel = autopilot.getIdleAPSfuelDeficiency(planet);
            if (apsIdleFuel)
            {
                fuelRetentionMass += apsIdleFuel;
            }
            var nonApsFuel = autopilot.getNonAPSfuelDeficiency(planet);
            if (nonApsFuel)
            {
                fuelRetentionMass += nonApsFuel;
            }
		    var futRes = autopilot.getFuturePlanetResources(planet, turns);
			return Math.floor(futRes.neutronium - fuelRetentionMass);
		},
        getSupDeficiency: function(planet)
        {
            var deficiency = 50; // retain 50 supplies on planet
            var sB = vgap.getStarbase(planet.id);
            if (sB)
            {
                deficiency += 100;
            }
            if (vgap.player.raceid == 10 || vgap.player.raceid == 11)
            {
                deficiency += 150;
            }
            if (autopilot.refineryAtPlanet(planet))
            {
                deficiency = 1050;
            }
            if (autopilot.alchemyAtPlanet(planet))
            {
                deficiency = 2700;
            }
            var tfdef = parseInt(planet.targetfactories) - parseInt(planet.factories);
            var tmdef = parseInt(planet.targetmines) - parseInt(planet.mines);
            var tddef = parseInt(planet.targetdefense) - parseInt(planet.defense);
            if (tfdef > 0) deficiency += tfdef;
            if (tmdef > 0) deficiency += tmdef;
            if (tddef > 0) deficiency += tddef;
            deficiency = parseInt(planet.supplies) - deficiency;
            return deficiency;
        },
		getMcDeficiency: function(planet, nupBase)
		{
		    // deficiency is based on building que
            // toDo: consider the demand of money at starbases building particular ships...
			var deficiency = 0;
			var starbase = vgap.getStarbase(planet.id);
			if (starbase || nupBase)
            {
                // toDo: consider techLevels... if all are level 1, less deficiency
                deficiency = 10000;
            }
			var tfdef = parseInt(planet.targetfactories) - parseInt(planet.factories);
			var tmdef = parseInt(planet.targetmines) - parseInt(planet.mines);
			var tddef = parseInt(planet.targetdefense) - parseInt(planet.defense);
			if (tfdef > 0) deficiency += (tfdef * 3);
			if (tmdef > 0) deficiency += (tmdef * 4);
			if (tddef > 0) deficiency += (tddef * 10);
			deficiency = parseInt(planet.megacredits) - deficiency;
			return deficiency;
		},
        getSumOfSurfaceMinerals: function(planet)
        {
            var p = planet;
            return parseInt(p.duranium+p.tritanium+p.molybdenum);
        },
        getSumOfAllMinerals: function(planet)
        {
            var p = planet;
            return parseInt(p.duranium+p.groundduranium+p.tritanium+p.groundtritanium+p.molybdenum+p.groundmolybdenum);
        },
		getSumAvailableObjects: function(planet, object)
		{
			if (object == "clans")
			{
				return autopilot.getFreeClans(planet);
			} else if (object == "neutronium")
			{
				return autopilot.getFuelDeficiency(planet);
			} else if (object == "megacredits")
			{
				return autopilot.getMcDeficiency(planet);
			} else if (object == "minerals")
            {
                return autopilot.getSumOfAllMinerals(planet);
            } else if (object == "supplies")
            {
                return autopilot.getSupDeficiency(planet);
            }
			return 0;
		},
		collectSourceSinkData: function()
		{
		    console.log("Collecting Source and Sink data of " + vgap.myplanets.length + " planet(s)");
			autopilot.clanSources = [];
			autopilot.neuSources = [];
			autopilot.supSources = [];
			autopilot.mcSources = [];
			autopilot.clanDeficiencies = [];
			autopilot.neuDeficiencies = [];
			autopilot.supDeficiencies = [];
			autopilot.mcDeficiencies = [];
			for (var i = 0; i < vgap.myplanets.length; i++)
            {
                var planet = vgap.myplanets[i];
                var n = vgap.getNote(planet.id, 1);
                var nupBase = false;
                var nupHub = false;
                var plDefNote = [];
                var plExcNote = [];
                if (n != null && n.body.match(/nup:base/) != null)
                {
                    nupBase = true;
                }
                if (n != null && n.body.match(/nup:hub/) != null)
                {
                    nupHub = true;
                }
                if (planet.ownerid == vgap.player.id)
                {
                    // clan sinks (-) and sources (+)
                    var def = autopilot.getClanDeficiency(planet, nupBase);
                    if (def > 0)
                    {
                        plExcNote.push("c:+" + def);
                        if (def > 50 && planet.nativeracename != "Amorphous") autopilot.clanSources.push({ pid: planet.id, x: planet.x, y: planet.y, value: def });
                    } else if (def < 0)
                    {
                        plDefNote.push("c:" + def);
                        autopilot.clanDeficiencies.push({ pid: planet.id, x: planet.x, y: planet.y, deficiency: def, government: planet.nativegovernment });
                    }
                    // neutronium sinks (-) and sources (+)
                    def = autopilot.getFuelDeficiency(planet, 0, (nupBase || nupHub));
                    if (def > 0)
                    {
                        plExcNote.push("f:+" + def);
                        if (def > 100) autopilot.neuSources.push({ pid: planet.id, x: planet.x, y: planet.y, value: def });
                    } else if (def < 0)
                    {
                        plDefNote.push("f:" + def);
                        autopilot.neuDeficiencies.push({ pid: planet.id, x: planet.x, y: planet.y, deficiency: def });
                    }
                    // supply sinks (-) and sources (+)
                    def = autopilot.getSupDeficiency(planet);
                    if (def > 0)
                    {
                        plExcNote.push("s:+" + def);
                        if (def > 50) autopilot.supSources.push({ pid: planet.id, x: planet.x, y: planet.y, value: def });
                    } else if (def < 0)
                    {
                        plDefNote.push("s:" + def);
                        autopilot.supDeficiencies.push({ pid: planet.id, x: planet.x, y: planet.y, deficiency: def, resources: autopilot.getSumAvailableObjects(planet, "minerals") });
                    }
                    // megacredit sinks (-) and sources (+)
                    def = autopilot.getMcDeficiency(planet, nupBase);
                    if (def > 0)
                    {
                        plExcNote.push("m:+" + def);
                        if (def > 200) autopilot.mcSources.push({ pid: planet.id, x: planet.x, y: planet.y, value: def });
                    } else if (def < 0)
                    {
                        plDefNote.push("m:" + def);
                        autopilot.mcDeficiencies.push({ pid: planet.id, x: planet.x, y: planet.y, deficiency: def, resources: autopilot.getSumAvailableObjects(planet, "minerals") });
                    }
                }
                var nBody = [];
                if (nupBase)
                {
                    nBody.push("nup:base");
                }
                if (nupHub)
                {
                    nBody.push("nup:hub");
                }
                if (plDefNote.length > 0)
                {
                    var dN = ["d","{"];
                    dN = dN.concat(plDefNote);
                    dN.push("}");
                    nBody.push(dN.join(" "));
                }
                if (plExcNote.length > 0)
                {
                    var eN = ["e","{"];
                    eN = eN.concat(plExcNote);
                    eN.push("}");
                    nBody.push(eN.join(" "));
                }
                if (autopilot.configuration && autopilot.configuration.debug)
                {
                    n.body = nBody.join("|");
                }
            }
		},
		ownerForPlanet: function(planet)
		{
			return planet.ownerid > 0 ? vgap.players[planet.ownerid - 1].raceid : vgap.player.raceid;
		},
		getBovinoidSupClanDeficiency: function(planet)
		{
			if (planet.nativeracename == "Bovinoid") {
				var potentialSupply = Math.round(planet.nativeclans / 100);
				//console.log("Bovinoids on " + planet.name + " supply = " + potentialSupply);
				var deficiency = planet.clans - potentialSupply;
				//console.log("supplyClanDeficiency = " + deficiency);
				return deficiency;
			}
			return 0;
		},
		getMaxColonistPopulation: function(planet)
		{
			if (planet.temp > -1)
			{
				var race = autopilot.ownerForPlanet(planet);
				if (race == 7)
				{
					return (planet.temp * 1000);
				} else if (planet.temp > 84 && (race == 4 || race == 9 || race == 10 || race == 11)) // desert worlds // toDo: this is usually > 80, but seems wrong
				{
					return 60;
				} else if (planet.temp > 84) // desert worlds
				{
					return Math.round( ( 20099.9 - (200 * planet.temp) ) / 10 );
				} else if (planet.temp < 19 && race == 10) // arctic worlds
				{
					return 90000;
				} else if (planet.temp < 15) // arctic worlds
				{
					return Math.round( ( 299.9 + (200 * planet.temp) ) / 10 );
				} else // temperate worlds
				{
					return Math.round(Math.sin(3.14 * (100 - planet.temp) / 100 ) * 100000);
				}
			}
			return null;
		},
		getIncomeFromNatives: function(planet, taxRate)
		{
			// Taxes = (Native Clans) * (Native Tax Rate) * (Planet Tax Efficiency=Native Government / 5) / 10
			if (planet.nativeclans > 0) {
				var race = autopilot.ownerForPlanet(planet);
				if (race == 6) if (taxRate > 20) taxRate = 20;
				var income = planet.nativeclans * (taxRate / 100) * (planet.nativegovernment / 5) / 10;
				if (planet.nativeracename == "Insectoid") income *= 2;
				if (race == 1) income *= 2;
				if (race == 12) income = planet.nativeclans;
				if (income > autopilot.MaxIncome) income = autopilot.MaxIncome;
				if (race != 12 && planet.nativeracename == "Amorphous") income = 0;
				if (race == 12 && planet.nativeracename == "Siliconoid") income = 0;
				return income;
			}
			return 0;
		},
		behaviourHasToChange: function(current, future)
		{
			return (current.shipFunction != future.shipFunction || current.ooiPriority != future.ooiPriority);
		},
		clearShipTarget: function(shipId)
		{
			var ship = vgap.getShip(shipId);
			ship.targetx = ship.x;
			ship.targety = ship.y;
		},
		clearShipNote: function(shipId)
		{
			var ship = vgap.getShip(shipId);
			if (ship.note)
			{
				ship.note.body = " ";
			}
		},
        isInStorage: function(shipId)
        {
            var storedGameData = autopilot.loadGameData();
            if (storedGameData === null) // no storage setup yet
            {
                return false;
            } else
            {
                // storage available...
                for(var i = 0; i < storedGameData.length; i++)
                {
                    // ...look for entry of the current APS
                    if (storedGameData[i].sid == shipId)
                    {
                        if (typeof storedGameData[i].idle == "undefined") storedGameData[i].idle = false; // to make older data conform
                        return storedGameData[i];
                    }
                }
            }
            return false;
        },
        loadGameSetting: function()
        {
            var storedCfgData = JSON.parse(localStorage.getItem(autopilot.storageCfgId));
            if (storedCfgData === null) // no storage setup yet
            {
                var gdo = new APSSettings();
                var cfgData = gdo.getData();
                if (cfgData)
                {
                    return storedGameData;
                } else
                {
                    return false;
                }
            } else {
                return storedCfgData;
            }
        },
        loadGameData: function(data)
        {
            var storedGameData = JSON.parse(localStorage.getItem(autopilot.storageId));
            if (storedGameData === null) // no storage setup yet
            {
                if (typeof data == "undefined") return false;
                var gdo = new APSdata(data);
                var gameData = gdo.getData();
                if (gameData)
                {
                    storedGameData = [];
                    storedGameData.push(gameData);
                    autopilot.saveGameData(storedGameData);
                    return storedGameData;
                } else
                {
                    return false;
                }
            } else {
                return storedGameData;
            }
        },
		syncLocalStorage: function(data)
		{
			// load data
			var storedGameData = autopilot.loadGameData(data);
			if (!storedGameData) // error
			{
			    console.error("Mandatory field empty!");
				return false;
			} else
			{
				// storage available...
				for(var i = 0; i < storedGameData.length; i++)
				{
					// ...look for entry of this APS
					if (storedGameData[i].sid == data.sid)
					{
						// if turned off
                        if (data.action == "END" || data.action == "DEL")
                        {
                            storedGameData.splice(i, 1); // delete stored data entry
                            if (data.action == "END")
                            {
                                // set ship waypoint to current position
                                autopilot.clearShipTarget(data.sid);
                                // clear the ship note toDo: delete ship note?
                                autopilot.clearShipNote(data.sid);
                            }
                        } else
						{
							// if ship function or priority has been changed...
							if (autopilot.behaviourHasToChange(storedGameData[i], data) && data.destination)
							{
								// ship will finish current assignment (fly to destination) and then adapt to new setting
								// set new function and new ooIPriority
								storedGameData[i].newFunction = data.shipFunction;
								storedGameData[i].newOoiPriority = data.ooiPriority;
							} else if (autopilot.behaviourHasToChange(storedGameData[i], data) && !data.destination)
							{
								// since no destination is set, we can change the behaviour immediately
								storedGameData[i].shipFunction = data.shipFunction;
								storedGameData[i].ooiPriority = data.ooiPriority;
							}
							// if the base has changed, update
							if (data.base && storedGameData[i].base != data.base) storedGameData[i].base = data.base;
                            // if idle status has changed, update
                            if (data.idle && storedGameData[i].idle != data.idle) storedGameData[i].idle = data.idle;
                            // if destination is provided, update/set
							if (typeof data.destination != "undefined") storedGameData[i].destination = data.destination;
                            if (typeof data.secondaryDestination != "undefined") storedGameData[i].secondaryDestination = data.secondaryDestination;
						}
                        autopilot.saveGameData(storedGameData);
						return storedGameData[i];
					}
				}
				// no stored data for this APS available
				//
                var gdo = new APSdata(data);
                var gameData = gdo.getData();
				storedGameData.push(gameData);
                autopilot.saveGameData(storedGameData);
				return data;
			}
		},
        saveGameData: function(gameData)
        {
            localStorage.setItem(autopilot.storageId, JSON.stringify(gameData));
        },
        setupStorage: function()
        {
            if (typeof(localStorage) == "undefined") {
                console.warn("Sorry! No Web Storage support..");
            }
            var isChromium = window.chrome,
                winNav = window.navigator,
                vendorName = winNav.vendor,
                isOpera = winNav.userAgent.indexOf("OPR") > -1,
                isIEedge = winNav.userAgent.indexOf("Edge") > -1,
                isIOSChrome = winNav.userAgent.match("CriOS");

            if(isIOSChrome){
                // is Google Chrome on IOS
                autopilot.isChromeBrowser = true;
            } else if(isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera == false && isIEedge == false) {
                // is Google Chrome
                autopilot.isChromeBrowser = true;
            } else {
                // not Google Chrome
            }

            var createdBy = "";
            if (vgap.game.createdby == "none")
            {
                createdBy = "default";
            } else
            {
                createdBy = vgap.game.createdby
            }

            autopilot.storageId = "nuPilot" + createdBy + vgap.game.id;
            autopilot.storageCfgId = "nuPilotCfg" + createdBy + vgap.game.id;
        },
        updateAPS: function(shipId, cfgData)
        {
            console.error("Updating APS " + shipId);
            var ship = vgap.getShip(shipId);
            autopilot.syncLocalStorage(cfgData);
            if (ship.note) ship.note.body += "(*)";
        },
		setupAPS: function(shipId, cfgData)
		{
		    if (typeof cfgData == "undefined")
            {
                cfgData = autopilot.isInStorage(shipId); // false if not in storage
                console.error("Retry setting up APS " + shipId);
            } else
            {
                console.error("Setting up new APS " + shipId);
            }

			var ship = vgap.getShip(shipId);
			var aps = new APS(ship, cfgData);
			if (aps.isAPS)
			{
				if (aps.hasToSetPotDes)
				{
                    autopilot.populateFrnnCollections();
                    if (aps.primaryFunction == "dis") autopilot.collectSourceSinkData();
					console.error("Set potential destinations for APS " + aps.ship.id);
					aps.functionModule.setPotentialDestinations(aps);
                    if (aps.potDest.length > 0) {
                        console.error("Set mission destinations for APS " + aps.ship.id);
                        aps.setMissionDestination();
                    }
				}
				if (!aps.isIdle)
                {
                    console.error("Confirm mission for APS " + aps.ship.id);
                    aps.confirmMission();
                    aps.updateNote();
                }
			} else
			{
				aps.updateNote();
			}
		},
		/*
         * processload: executed whenever a turn is loaded: either the current turn or
         * an older turn through time machine
         */
		processload: function() {
            console.log(vgap);
            autopilot.scanReports();
            // toDo: load setup from local storage, user interface
            setup = {
                debug: false
            };
            var apSettings = new APSSettings(setup);
            autopilot.configuration = apSettings.getSettings();
            //console.log("realTurn = " + autopilot.realTurn + " / " + vgap.game.turn);
            if (!autopilot.realTurn || autopilot.realTurn < vgap.game.turn || autopilot.gameId != vgap.game.id)
            {
                autopilot.realTurn = vgap.game.turn;
                autopilot.gameId = vgap.game.id;
            }
            //console.log("realTurn = " + autopilot.realTurn + " / " + vgap.game.turn);
            //console.log(vgap.game.turn);
		    if (autopilot.realTurn == vgap.game.turn) // only act, when we are in the present
            {
                autopilot.setupStorage();
                autopilot.scanReports();
                autopilot.populateFrnnCollections();
                //
                // APS - Initial setup...
                //
                var nCols = ["ff3399", "6666ff", "ffc299", "66b3ff", "ff99ff", "6699ff", "7fffd4", "ee3b3b"];
                var disCol = "D3D3D3";
                var expCol = "FFFF00";
                var noteColByBase = {}; // color of note text
                var apsControl = [];
                vgap.myships.forEach(function(ship) {
                    var aps = {};
                    var cfgData = autopilot.isInStorage(ship.id);
                    if (cfgData)
                    {
                        // if configuration is available in storage
                        aps = new APS(ship, cfgData);
                        if (aps.primaryFunction == "dis")
                        {
                            aps.noteColor = disCol;
                        } else if (aps.primaryFunction == "exp")
                        {
                            aps.noteColor = expCol;
                        } else
                        {
                            if (noteColByBase[aps.base.id])
                            {
                                aps.noteColor = noteColByBase[aps.base.id];
                            } else
                            {
                                if (nCols.length > 0)
                                {
                                    noteColByBase[aps.base.id] = nCols.shift();
                                    aps.noteColor = noteColByBase[aps.base.id];
                                } else {
                                    aps.noteColor = "ffffff";
                                }
                            }
                        }
                    }
                    if (aps.isAPS)
                    {
                        // add APS to APS-list
                        apsControl.push(aps);
                    }
                });
                //
                // APS that arrived at destination did unload their cargo...
                //
                autopilot.collectSourceSinkData();
                //
                // APS without destination need to determine potential destinations
                //
                apsControl.forEach(function(shipcontrol) {
                    if (shipcontrol.hasToSetPotDes)
                    {
                        console.error("Set potential destinations for APS " + shipcontrol.ship.id);
                        shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                    }
                });
                //
                // APS with potential mission destinations now evaluate potential destinations and pick target(s)
                //
                apsControl.forEach(function(shipcontrol) {
                    if (shipcontrol.potDest.length > 0)
                    {
                        console.error("Set mission destination for APS " + shipcontrol.ship.id);
                        shipcontrol.setMissionDestination();
                    }
                    if (!shipcontrol.isIdle)
                    {
                        console.error("Confirm mission of APS " + shipcontrol.ship.id);
                        shipcontrol.confirmMission();
                        shipcontrol.updateNote();
                    }
                });
                apsControl.forEach(function(shipcontrol)
                {
                    // retry idle ships
                    if (shipcontrol.isIdle)
                    {
                        console.error("Retry idle ship " + shipcontrol.ship.id);
                        if (!shipcontrol.destination)
                        {
                            console.error("Set potential destinations for APS " + shipcontrol.ship.id);
                            shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                            if (shipcontrol.potDest.length > 0)
                            {
                                console.error("Setting mission destination of APS " + shipcontrol.ship.id);
                                shipcontrol.setMissionDestination();
                            }
                        }
                        if (!shipcontrol.isIdle)
                        {
                            console.error("Confirm mission of APS " + shipcontrol.ship.id);
                            shipcontrol.confirmMission();
                            shipcontrol.updateNote();
                        }
                    }
                    // set changed for every APS
                    shipcontrol.ship.changed = 1;
                });
            }
            //console.log(vgap.messages);
		},
		/*
         * loaddashboard: executed to rebuild the dashboard content after a turn is loaded
         */
		loaddashboard: function() {
			//console.log("LoadDashboard: plugin called.");
		},

		/*
         * showdashboard: executed when switching from starmap to dashboard
         */
		showdashboard: function() {
			//console.log("ShowDashboard: plugin called.");
		},
		/*
         * showsummary: executed when returning to the main screen of the dashboard
         */
		showsummary: function() {
			//console.log("ShowSummary: plugin called.");
		},
		/*
         * loadmap: executed after the first turn has been loaded to create the map
         * as far as I can tell not executed again when using time machine
         */
		loadmap: function() {
			//console.log("LoadMap: plugin called.");
		},
		/*
         * showmap: executed when switching from dashboard to starmap
         */
		showmap: function() {
			//console.log("ShowMap: plugin called.");
		},
		/*
         * draw: executed on any click or drag on the starmap
         */
		draw: function() {
			//console.log("Draw: plugin called.");
		},
		/*
         * loadplanet: executed when a planet is selected on dashboard or starmap
         *
         * Inside the function "load" of vgapPlanetScreen (vgapPlanetScreen.prototype.load) the normal planet screen
         * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadplanet");'.
         *
         * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
         * can be accessed here as "vgap.planetScreen.X".
         */
		loadplanet: function() {
			console.log("LoadPlanet: plugin called.");
			//console.log("Planet id: " + vgap.planetScreen.planet.id);
            // toDo: is there a close planet screen hook? or a transfer ocurred hook?
            // It would be helpful to reinitialize (or update) APS which
            // - are at the planet (if resources / deficiencies / excess changed)
            // - have this planet as destination (if resources / deficiencies / excess changed)
            // - have this planet as next target (mainly because of fuel...)
		},
		/*
         * loadstarbase: executed when a starbase is selected on dashboard or starmap
         *
         * Inside the function "load" of vgapStarbaseScreen (vgapStarbaseScreen.prototype.load) the normal starbase screen
         * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadstarbase");'.
         *
         * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
         * can be accessed here as "vgap.starbaseScreen.X".
         */
		loadstarbase: function() {
			//console.log("LoadStarbase: plugin called.");
			//console.log("Starbase id: " + vgap.starbaseScreen.starbase.id + " on planet id: " + vgap.starbaseScreen.planet.id);
		},

		/*
         * loadship: executed when a planet is selected on dashboard or starmap
         * Inside the function "load" of vgapShipScreen (vgapShipScreen.prototype.load) the normal ship screen
         * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadship");'.
         *
         * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
         * can be accessed here as "vgap.shipScreen.X".
         */
		loadship: function() {
			console.log("LoadShip: plugin called.");
            var apsData = autopilot.isInStorage(vgap.shipScreen.ship.id);
			if (apsData && apsData.idle)
            {
                console.log("Ship idle status: " + apsData.idle);
                autopilot.setupAPS(vgap.shipScreen.ship.id, apsData);
            }
		}
	};
	// register your plugin with NU
	vgap.registerPlugin(autopilot, "autopilotPlugin");
} //wrapper for injection

var script = document.createElement("script");
script.type = "application/javascript";
script.textContent = "(" + wrapper + ")();";

document.body.appendChild(script);
