// ==UserScript==
// @name          nuPilot
// @description   Planets.nu plugin to enable semi-intelligent auto-pilots
// @version       0.05 (50)
// @date          2017-01-02
// @author        drgirasol
// @include       http://planets.nu/*
// @include       http://play.planets.nu/*
// @include       http://test.planets.nu/*
// @resource	  Documentation https://github.com/drgirasol/nupilot/wiki
// @updateURL     https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.user.js
// @downloadURL   https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.user.js
// @history       0.01 (01)  Initial [2016-11-19]
// @history       0.02 (22)  Collectors & Distributers - an Introduction [2016-12-05]
// @history       0.03 (35)  Transition from note configuration to shipScreen Mission Dialog configuration [2016-12-26]
// @history       0.04 (40)  Colonization module (Expander) added [2016-12-28]
// @history       0.04 (41)  Ally minefields, planets and ships are no longer recognized as danger [2016-12-30]
// @history       0.05 (44)  Alchemy module (Alchemist) added [2016-12-31]
// ==/UserScript==


function wrapper () { // wrapper for injection
	/*
	 *  Specify your plugin
	 *  You need to have all those methods defined or errors will be thrown.
	 *  I inserted the print-outs in order to demonstrate when each method is
	 *  being called. Just comment them out once you know your way around.
	 *
	 *  For any access to plugin class variables and methods from inside these
	 *  reserved methods, "vgap.plugins["nameOfMyPlugin"].my_variable" has to be
	 *  used instead of "this.my_variable".
	 */
	//
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
                if (vgap.player.raceid != 12) {
					a.push({
                        name: "APC",
                        onclick: function() {
                            vgap.shipScreen.autopilotControl();
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
				hullId: 0
			},
			{
				name: "Distribute Resources",
				desc: "Distribute resources from sources to sinks.",
				shipFunction: "dis",
				ooiOptions: [ "neu", "cla", "mcs" ],
				hullId: 0
			},
			{
				name: "Alchemy",
				desc: "Load supply and unload products",
				shipFunction: "alc",
				ooiOptions: [ "all", "dur", "tri", "mol" ],
				hullId: 0
			},
			{
				name: "Colonize",
				desc: "Colonize unowned planets",
				shipFunction: "exp",
				ooiOptions: [ "cla" ],
				hullId: 0
			},
			{
				name: "Deactivate",
				desc: "Deactivate auto-pilot",
				shipFunction: "000",
				ooiOptions: [ "END" ],
				hullId: 0
			}
		];
		var curMission = vgap.shipScreen.ship.mission;
		vgap.more.empty();
        $("<div id='OrdersScreen'><h1>Auto-Pilot-Control</h1></div>").appendTo(vgap.more);
		//
        for (var a = 0; a < apcOptions.length; a++) 
		{
            var c = apcOptions[a];
			if (vgap.shipScreen.ship.hullid != 105 && c.shipFunction == "alc") continue; // only show alchemy module if its an alchemy ship
			//
			var d = function(g) {
				return function() {
					vgap.shipScreen.selectMission(curMission);
				};
			};
			if (c.ooiOptions.length > 1)
			{
				$("<div>" + c.name + "<span>" + c.desc + "<br/>Priority: <b id='ooiPriority" + c.shipFunction + "'></b></span></div>").tclick(d()).appendTo("#OrdersScreen");
				for (j = 0; j < c.ooiOptions.length; j++)
				{
					var clickf = function(g, h) {
						return function() {
							var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
							var data = { sid: vgap.shipScreen.ship.id, base: planet.id, shipFunction: g, ooiPriority: h };
							var cfgData = autopilot.syncLocalStorage(data);
							if (h != "END") autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData);
							return false;
						};
					};
					$("<a style='color:cyan;font-size: 10px;'>" + c.ooiOptions[j] + " </a>").tclick(clickf(c.shipFunction, c.ooiOptions[j])).appendTo("#ooiPriority" + c.shipFunction);
				}
			} else
			{
				var d = function(g, h) {
					return function() {
						var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
						var data = { sid: vgap.shipScreen.ship.id, base: planet.id, shipFunction: g, ooiPriority: h };
						var cfgData = autopilot.syncLocalStorage(data);
						if (h != "END") autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData);
						vgap.shipScreen.selectMission(curMission);
					};
				};
				$("<div>" + c.name + "<span>" + c.desc + "</span></div>").tclick(d(c.shipFunction, c.ooiOptions[0])).appendTo("#OrdersScreen");
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
	 * Autopilot - Expansion Module
	 */
	function alchemyAPS(aps)
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
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
		// as alchemist, current planet is a sink
		this.sources = [{ x: aps.ship.x, y: aps.ship.y , distance: 0, deficiency: 0}];
	};
	alchemyAPS.prototype.isSource = function(planet)
	{
		if (planet.supplies > 0) return true;
		return false;
	};
	alchemyAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (aps.destination) return;
		console.log("Determine potential destinations...");
		// by planet.id sorted sinks (deficiencies)
		if (this.sinks.length === 0) this.setSinks(aps);
		// by planet.id sorted sources (two piles -high/low value- by distance)
		if (this.sources.length === 0) this.setSources(aps);
		//
		if (this.isSource(aps.planet))
		{
			// if we are at source, set sinks as potential destinations
			console.log("...for expander at source...");
			// aps.potDest = this.sinks;
		} else
		{
			// set sources as potential destinations, if we are at a sink
			console.log("...for expander at an unowned planet...");
			// aps.potDest = this.sources;
		}
		if (aps.potDest.length === 0)
		{
			console.log("setPotentialDestinations: no destinations available...");
		} else
		{
			console.log(aps.potDest);
		}
	};
	alchemyAPS.prototype.updateMission = function(aps)
	{
		if (aps.potDest.length > 0) // we are at a planet and have potential destinations set
		{
			// evaluate mission destinations & select Target
			aps.potDest = aps.evaluateMissionDestinations();
			//console.log("Potential target: ");
			//console.log(aps.potDest[0]);
			//console.log(aps.potDest);
			this.selectMissionDestination(aps);
			// load cargo if at source
			// this.handleCargo(aps); // load specific amount...
		} else
		{
			console.log("Alchemist stays...");
			this.updateFC(aps);
			this.handleCargo(aps); // load specific amount...
			// toDo: check for danger
		}
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
	alchemyAPS.prototype.confirmMission = function(aps)
	{
		if (aps.potDest === 0) // we are not at our destination
		{
			console.log("Collector is in-route to its destination...");
			var curTarget = vgap.planetAt(aps.ship.targetx, aps.ship.targety);
			if (aps.objectInRangeOfEnemy(curTarget))
			{
				// return to base, if we are in dangerous space
				// jettison cargo?
				aps.setShipTarget(aps.base.x, aps.base.y);
			}
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		} else {
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		}
	};
	alchemyAPS.prototype.selectMissionDestination = function(aps)
	{
		if (aps.potDest.length > 0)
		{
			// set Target (and if not set yet, destination)
			aps.setShipTarget(aps.potDest[0].x, aps.potDest[0].y);
			// set full warp
			aps.setWarp();
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
		var curCargo = 0;
		curCargo += aps.loadObject("supplies", aps.planet);
		return curCargo;
	};
	/*
	 * Autopilot - Expansion Module
	 */
	function expanderAPS(aps)
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
		this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
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
		this.sinks = autopilot.frnnUnownedPlanets;
		// and the object of interest will always be clans
		for (var i = 0; i < this.sinks.length; i++)
		{
			if (aps.getMissionConflict(this.sinks[i].pid)) continue;
			var sinkPlanet = vgap.getPlanet(this.sinks[i].pid);
			this.frnnSinks.push({x: sinkPlanet.x, y: sinkPlanet.y});
			var distance = Math.floor(aps.getDistance({x: sinkPlanet.x, y: sinkPlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			this.sinks[i].deficiency = 150;
			if (sinkPlanet.temp > -1) this.sinks[i].deficiency = autopilot.getMaxColonistPopulation(sinkPlanet) * -1;
			this.sinks[i].distance = distance;
			// data already known...
			this.sinks[i].x = sinkPlanet.x;
			this.sinks[i].y = sinkPlanet.y;
		}
		// priorities by degree of deficiency (split)... and sort splits by distance
		this.sinks = aps.getDevidedCollection(this.sinks, "deficiency", this.devideThresh, "distance");
		//console.log(this.sinks);
	};
	expanderAPS.prototype.setSources = function(aps)
	{
		// sources are the same as for a distributer distributing clans
		this.sources = autopilot.clanSources;
		console.log(this.sources);
		for (var i = 0; i < this.sources.length; i++)
		{
			// if (aps.getMissionConflict(this.sources[i].pid)) continue; // necessary?
			var sourcePlanet = vgap.getPlanet(this.sources[i].pid);
			this.frnnSources.push({x: sourcePlanet.x, y: sourcePlanet.y});
			var distance = Math.floor(aps.getDistance({x: sourcePlanet.x, y: sourcePlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			// within the simpleRange (and a multitude of it), differences in distance not really matter
			if (distance <= aps.simpleRange) distance = 1;
			// update deficiencies (...unloading has occured)
			var value = autopilot.getFreeClans(sourcePlanet);
			if (value < 500) value = 0; // only higly over-populated planets are considered sources
			this.sources[i].value = value;
			this.sources[i].distance = distance;
			this.sources[i].x = sourcePlanet.x;
			this.sources[i].y = sourcePlanet.y;
		}
		// priorities by degree of value (split)... and sort splits by distance
		this.sources = aps.getDevidedCollection(this.sources, "value", this.devideThresh, "value", "desc");
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
	expanderAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (aps.destination) return;
		console.log("Determine potential destinations...");
		// by planet.id sorted sinks (deficiencies)
		if (this.sinks.length === 0) this.setSinks(aps);
		// by planet.id sorted sources (two piles -high/low value- by distance)
		if (this.sources.length === 0) this.setSources(aps);
		//
		if (this.isSource(aps.planet))
		{
			// if we are at source, set sinks as potential destinations
			console.log("...for expander at source...");
			aps.potDest = this.sinks;
			// sort by value... high to low
			// aps.potDest = aps.sortCollection(aps.potDest, "value", "desc");
		} else
		{
			// set sources as potential destinations, if we are at a sink
			console.log("...for expander at an unowned planet...");
			aps.potDest = this.sources;
		}
		if (aps.potDest.length === 0)
		{
			console.log("setPotentialDestinations: no destinations available...");
		} else
		{
			console.log(aps.potDest);
		}
	};
	expanderAPS.prototype.updateMission = function(aps)
	{
		if (aps.potDest.length > 0) // we are at a planet and have potential destinations set
		{
			// evaluate mission destinations & select Target
			aps.potDest = aps.evaluateMissionDestinations();
			console.log("Potential target: ");
			console.log(aps.potDest[0]);
			//console.log(aps.potDest);
			this.selectMissionDestination(aps);
			// load cargo if at source
			this.handleCargo(aps); // load specific amount...
		} else
		{
			console.log("Expander is on route...");
			// toDo: check for danger
		}
	};
	expanderAPS.prototype.confirmMission = function(aps)
	{
		if (aps.potDest === 0) // we are not at our destination
		{
			console.log("Collector is in-route to its destination...");
			var curTarget = vgap.planetAt(aps.ship.targetx, aps.ship.targety);
			if (aps.objectInRangeOfEnemy(curTarget))
			{
				// return to base, if we are in dangerous space
				// jettison cargo?
				aps.setShipTarget(aps.base.x, aps.base.y);
			}
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		} else {
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		}
	};
	expanderAPS.prototype.selectMissionDestination = function(aps)
	{
		if (aps.potDest.length > 0)
		{
			// set Target (and if not set yet, destination)
			aps.setShipTarget(aps.potDest[0].x, aps.potDest[0].y);
			// set full warp
			aps.setWarp();
		}
	};
	expanderAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			if (this.isSource(aps.planet)) // we are at a source
			{
				var transCargo = this.loadCargo(aps);
				console.log("Cargo summary: " + transCargo);
			} else // sink
			{
				aps.unloadCargo();
			}
		}
	};
	expanderAPS.prototype.loadCargo = function(aps)
	{
		var curCargo = 0;
		// colonist handling
		// cargo = 75 % clans, 25 % supply, supply * 3 MCs (factory building)
		var clans = Math.floor(0.75 * aps.hull.cargo);
		var supply = aps.hull.cargo - clans;
		var mcs = supply * 3;
		if (this.ooiPriority == "cla")
		{
			var value = autopilot.getFreeClans(aps.planet);
			if (value >= clans)
			{
				curCargo = aps.loadObject("clans", aps.planet, clans);
			} else
			{
				curCargo = aps.loadObject("clans", aps.planet, value);
			}
			if (aps.planet.supplies >= supply)
			{
				curCargo += aps.loadObject("supplies", aps.planet, supply);
			} else
			{
				curCargo += aps.loadObject("supplies", aps.planet, aps.planet.supplies);
			}
			aps.loadMegacredits(aps.planet, mcs);
		}
		return curCargo;
	};
	/*
	 * Autopilot - Collector Module
	 */
	function collectorAPS(aps)
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
		this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
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
        if (inRange.length > 2)
        {
            aps.scopeRange *= 2;
        } else if (inRange.length > 5)
        {
            aps.scopeRange *= 3;
        }
    };
	collectorAPS.prototype.setSources = function(aps)
	{
		this.setScopeRange(aps);
		var targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.scopeRange);
		//
		for (var i = 0; i < targetsInRange.length; i++)
		{
			var tPlanet = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
			// check 4 conflicts
			if (aps.getMissionConflict(tPlanet.id)) continue;
			var distance = Math.floor(aps.getDistance({x: tPlanet.x, y: tPlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			var tValue = 0;
			if (this.ooiPriority == "all")
			{
				// amount of all resources that are used to build ships
				tValue = parseInt(tPlanet.duranium) + parseInt(tPlanet.tritanium) + parseInt(tPlanet.molybdenum);
			} else if (this.ooiPriority == "cla")
			{
				// amount of free clans
				tValue = autopilot.getFreeClans(tPlanet);
			} else if (this.ooiPriority == "mcs")
			{
				// amount of theoretical cash (megacredits and supplies)
				tValue = parseInt(tPlanet.megacredits) + parseInt(tPlanet.supplies);
				// if we don't want to sell supplies on bovinoid planets we only count megacredits
				if (tPlanet.nativeracename == "Bovinoid" && this.sellSupply == "notBov") tValue = tPlanet.megacredits;
			} else
			{
				tValue = parseInt(tPlanet[aps.moveables[this.ooiPriority]]);
			}
			this.sources.push( { x: tPlanet.x, y: tPlanet.y, pid: tPlanet.id, value: tValue, distance: distance } );
		}
		this.sources = aps.getDevidedCollection(this.sources, "value", this.devideThresh, "distance");
	};
	collectorAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (aps.destination) return;
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
			// sort by value... high to low
			aps.potDest = aps.sortCollection(aps.potDest, "value", "desc");
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
	collectorAPS.prototype.updateMission = function(aps)
	{
		if (aps.potDest.length > 0) // we are at a planet with our primary base
		{
			if (aps.atBase) // = sink
			{
				console.log("Collector is at base...");
				aps.potDest = aps.evaluateMissionDestinations();
			} else
			{
				console.log("Collector is at source...");
				console.log(aps.potDest);
				// aps.potDest = [{x: aps.base.x, y: aps.base.y }];
			}
			this.selectMissionDestination(aps);
			this.handleCargo(aps);
		} else
		{
			console.log("Collector is on route...");
			// toDo: check for danger
		}
	};
	collectorAPS.prototype.confirmMission = function(aps)
	{
		if (aps.potDest === 0) // we are not at our destination
		{
			console.log("Collector is in-route to its destination...");
			var curTarget = vgap.planetAt(aps.ship.targetx, aps.ship.targety);
			if (aps.objectInRangeOfEnemy(curTarget))
			{
				// return to base, if we are in dangerous space
				// jettison cargo?
				aps.setShipTarget(aps.base.x, aps.base.y);
			}
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		} else {
			if (aps.checkFuel()) {
				//
			} else
			{
				// stay indevinently, send SOS ;)
			}
		}
	};
	collectorAPS.prototype.selectMissionDestination = function(aps)
	{
		if (aps.potDest.length > 0)
		{
			// set Target (and if not set yet, destination)
			aps.setShipTarget(aps.potDest[0].x, aps.potDest[0].y);
			// set full warp
			aps.setWarp();
		}
	};
	collectorAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			if (aps.atBase) // we are at base (sink)
			{
				aps.unloadCargo();
				if (this.ooiPriority == "neu") aps.unloadFuel();
			} else // source
			{
				var transCargo = this.loadCargo(aps);
				console.log("Cargo summary: " + transCargo);
			}
		}
	};
	collectorAPS.prototype.loadCargo = function(aps)
	{
		var curCargo = 0;
		// Supply & MC handling
		if (this.ooiPriority == "mcs" || (this.alwaysLoadMC && this.ooiPriority != "cla"))
		{
			if (!(this.sellSupply == "notBov" && aps.planet.nativeracename == "Bovinoid"))
			{
				aps.sellSupply();
			}
			aps.loadMegacredits(aps.planet);
		}
		// colonist handling
		if (this.ooiPriority == "cla")
		{
			var value = autopilot.getFreeClans(aps.planet);
			curCargo = aps.loadObject("clans", aps.planet, value);
		}
		// Resources handling
		if (this.ooiPriority != "mcs" && this.ooiPriority != "cla")
		{
			var baseSequence = [];
			var loadingSequence = [];
			if (this.ooiPriority == "all")
			{
				baseSequence = [ { res: "dur", value: parseInt(aps.planet.duranium) }, { res: "tri", value: parseInt(aps.planet.tritanium) }, { res: "mol", value: parseInt(aps.planet.molybdenum) } ];
			} else if (this.ooiPriority == "dur")
			{
				loadingSequence = ["duranium"];
				baseSequence = [ { res: "mol", value: parseInt(aps.planet.molybdenum) }, { res: "tri", value: parseInt(aps.planet.tritantium) } ];
			} else if (this.ooiPriority == "tri")
			{
				loadingSequence = ["tritanium"];
				baseSequence = [ { res: "mol", value: parseInt(aps.planet.molybdenum) }, { res: "dur", value: parseInt(aps.planet.duranium) } ];
			} else if (this.ooiPriority == "mol")
			{
				loadingSequence = ["molybdenum"];
				baseSequence = [ { res: "tri", value: parseInt(aps.planet.tritanium) }, { res: "dur", value: parseInt(aps.planet.duranium) } ];
			}
			// determine the (remaining) loading sequence by what is needed at base (sink)
			baseSequence = aps.sortCollection(baseSequence, "value", "desc");
			baseSequence.forEach(function(seq){ loadingSequence.push(aps.moveables[seq.res]); });
			console.log(loadingSequence);
			//
			// loading
			//
			for (var i = 0; i < loadingSequence.length; i++)
			{
				curCargo += aps.loadObject(loadingSequence[i], aps.planet);
				if (curCargo == aps.hull.cargo) break;
			}
		}
		return curCargo;
	};
	/*
	 *
	 * Autopilot - Distributor Module
	 *
	 */
	function distributorAPS(aps)
	{
		this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
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
	distributorAPS.prototype.setSinks = function(aps)
	{
		if (this.ooiPriority == "cla")
		{
			this.sinks = autopilot.clanDeficiencies;
		} else if (this.ooiPriority == "neu")
		{
			this.sinks = autopilot.neuDeficiencies;
		} else if (this.ooiPriority == "mcs")
		{
			this.sinks = autopilot.mcDeficiencies;
		}
		for (var i = 0; i < this.sinks.length; i++)
		{
			if (aps.getMissionConflict(this.sinks[i].pid)) continue;
			var sinkPlanet = vgap.getPlanet(this.sinks[i].pid);
			this.frnnSinks.push({x: sinkPlanet.x, y: sinkPlanet.y});
			var distance = Math.floor(aps.getDistance({x: sinkPlanet.x, y: sinkPlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			// update deficiencies (...unloading has occured)
			var def = 0;
			if (this.ooiPriority == "cla")
			{
				def = autopilot.getClanDeficiency(sinkPlanet);
			} else if (this.ooiPriority == "neu")
			{
				def = autopilot.getFuelDeficiency(sinkPlanet);
			} else if (this.ooiPriority == "mcs")
			{
				def = autopilot.getMcDeficiency(sinkPlanet);
			}
			if (def > 0) def = 0;
			this.sinks[i].deficiency = def;
			this.sinks[i].distance = distance;
			this.sinks[i].x = sinkPlanet.x;
			this.sinks[i].y = sinkPlanet.y;
		}
		// priorities by degree of deficiency (split)... and sort splits by distance
		this.sinks = aps.getDevidedCollection(this.sinks, "deficiency", this.devideThresh, "distance");
		console.log(this.sinks);
	};
	distributorAPS.prototype.isSink = function(planet)
	{
		//console.log(this.sinks);
		for (var i = 0; i < this.sinks.length; i++)
		{
			//console.log("Distributer| sinkPlanet: " + this.sinks[i].pid + " | curPlanet: " + planet.id);
			if (this.sinks[i].pid == planet.id) return true;
		}
		return false;
	};
	distributorAPS.prototype.setSources = function(aps)
	{
		if (this.ooiPriority == "cla")
		{
			this.sources = autopilot.clanSources;
		} else if (this.ooiPriority == "neu")
		{
			this.sources = autopilot.neuSources;
		} else if (this.ooiPriority == "mcs")
		{
			this.sources = autopilot.mcSources;
		}
		for (var i = 0; i < this.sources.length; i++)
		{
			if (aps.getMissionConflict(this.sources[i].pid)) continue; // necessary?
			var sourcePlanet = vgap.getPlanet(this.sources[i].pid);
			this.frnnSources.push({x: sourcePlanet.x, y: sourcePlanet.y});
			var distance = Math.floor(aps.getDistance({x: sourcePlanet.x, y: sourcePlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			// within the simpleRange (and a multitude of it), differences in distance not really matter
			if (distance <= aps.simpleRange) distance = 1;
			// update deficiencies (...unloading has occured)
			var value = 0;
			if (this.ooiPriority == "cla")
			{
				value = autopilot.getFreeClans(sourcePlanet);
			} else if (this.ooiPriority == "neu")
			{
				value = autopilot.getFuelDeficiency(sourcePlanet);
			} else if (this.ooiPriority == "mcs")
			{
				value = autopilot.getMcDeficiency(sourcePlanet);
			}
			if (value < 0) value = 0;
			this.sources[i].value = value;
			this.sources[i].distance = distance;
			this.sources[i].x = sourcePlanet.x;
			this.sources[i].y = sourcePlanet.y;
		}
		// priorities by degree of value (split)... and sort splits by distance
		this.sources = aps.getDevidedCollection(this.sources, "value", this.devideThresh, "distance");
		console.log(this.sources);
	};
	distributorAPS.prototype.isSource = function(planet)
	{
		for (var i = 0; i < this.sources.length; i++)
		{
			if (this.sources[i].pid == planet.id) return true;
		}
		return false;
	};
	distributorAPS.prototype.setPotentialDestinations = function(aps)
	{
		console.log("Determine potential destinations...");
		// by planet.id sorted sinks (deficiencies)
		if (this.sinks.length === 0) this.setSinks(aps);
		// by planet.id sorted sources (two piles -high/low value- by distance)
		if (this.sources.length === 0) this.setSources(aps);
		//
		// set sinks as potential destinations if we are at a source
		if (aps.planet && this.isSource(aps.planet))
		{
			aps.potDest = this.sinks;
		} else
		{
			// set sources as potential destinations if we are at a sink or a neutral place
			aps.potDest = this.sources;
		}
		if (aps.potDest.length === 0)
		{
			console.log("setPotentialDestinations: no destinations available...");
		}
	};
	distributorAPS.prototype.updateMission = function(aps)
	{
		if (aps.potDest.length > 0) // we are at a planet and have potential destinations set
		{
			// is the current planet a source or a sink?
			console.log("Distributor is at a planet...");
			/*
			var isSource = this.isSource(aps.planet);
			if (isSource)
			{
				// we are at a source, set sinks (which should be sorted by distance) as potDest
				console.log("...which is a source...");
				//console.log(this.sources);
				console.log(this.sinks);
				aps.potDest = this.sinks;
			} else
			{
				// we are at a sink or a neutral place, look for sources
				console.log("...which is a sink or a neutral planet...");
				//console.log(this.sinks);
				console.log(this.sources);
				aps.potDest = this.sources;
			} */
			// evaluate mission destinations & select Target
			aps.potDest = aps.evaluateMissionDestinations();
			console.log("Potential target: ");
			console.log(aps.potDest[0]);
			//console.log(aps.potDest);
			this.selectMissionDestination(aps);
			// load cargo if at source
			this.handleCargo(aps); // load specific amount...
		} else
		{
			console.log("Distributor is on route...");
			// toDo: check for danger
		}
	};
	distributorAPS.prototype.confirmMission = function(aps)
	{
		if (aps.destination) // destination is set
		{
			if (aps.planet) // we are at planet
			{
				if (aps.checkFuel()) {
					console.log("Checkfuel ok...");
				} else
				{
					console.warn("Checkfuel not ok...");
					// stay indefinently, send SOS ;)
                    aps.isIdle = 1;
                    aps.updateStoredData();
				}
			} else // we are in space
			{
				var curTarget = vgap.planetAt(aps.ship.targetx, aps.ship.targety);
				if (aps.objectInRangeOfEnemy(curTarget))
				{
					// return to base, if we are in dangerous space (or just in the opposite direction of enemy?
					// jettison cargo?
					console.warn("Emergency: Enemy in range - flight mode -> returning back to base!");
					aps.setShipTarget(aps.base.x, aps.base.y);
				}
			}
		} else {
			console.warn("Distributor is idle...");
			aps.isIdle = 1;
            aps.updateStoredData();
		}
	};
	distributorAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			var transCargo = 0;
			if (this.isSource(aps.planet))
			{
				// unload cargo
				aps.unloadCargo();
				// load cargo
				transCargo = this.loadCargo(aps);
			} else if (this.isSink(aps.planet))
			{
				// unload cargo
				aps.unloadCargo();
				if (this.ooiPriority == "neu") aps.unloadFuel();
			}
			console.log("Cargo summary: " + transCargo);
		}
	};
	distributorAPS.prototype.loadCargo = function(aps)
	{
		var transCargo = 0;
		var deficiency = Math.floor((this.sinks[0].deficiency * -1) * 1.1); // bring more...
		if (deficiency > 0)
		{
			var object = aps.moveables[this.ooiPriority];
			var available = autopilot.getAvailability(aps.planet, object);
			if (available < 0) available = 0;
			if (deficiency > available) deficiency = available;
			transCargo = aps.loadObject(object, aps.planet, deficiency);
		}
		console.log("Loaded (" + this.ooiPriority + "): " + transCargo + "/" + deficiency);
		return (transCargo - deficiency);
	};
	distributorAPS.prototype.selectMissionDestination = function(aps)
	{
		if (aps.potDest.length > 0)
		{
			// set Target (and if not set yet, destination)
			aps.setShipTarget(aps.potDest[0].x, aps.potDest[0].y);
			// set full warp
			aps.setWarp();
		}
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

		this.scopeRange = 162;

		this.simpleRange = 81; // warp 9 max turn distance
		this.maxRange = 160; // adjusted by maxRange
		this.defaultFixedRadius = 160; // adjusted by maxRange (=50 %)

		this.planet = false; // current planet (if at any)
		this.base = false; // base -> planet object
		this.atBase = false;
		this.destination = false; // destination -> planet object
		this.atDestination = false;
		//
        this.storedData = false;
		this.primaryFunction = false;
		this.objectOfInterest = false;
		this.functionModule = {};
		this.hasToSetPotDes = false;
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
		//
		// this.enemyAlert = false; // if enemies are in range posing immediate danger (freighters = danger?, is enemy "in our way"?)
		//
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
		if (this.hull.special && this.hull.special.match(/^Gravitonic/)) this.gravitonic = true;
		this.setRange(); // simple- and max-range AND defaultFixedRadius (1/2 max-range)
		//
		// current position
		//
		this.planet = vgap.planetAt(this.ship.x, this.ship.y);
		if (this.planet && this.planet.ownerid != vgap.player.id && cfgFunction != "exp") this.planet = false; // we don't want to interact (yet) with planets not owned by us
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
		this.bootFunctionModule(cfgFunction);
		//
		this.functionModule.devideThresh = this.getDevisionThresh();
		this.functionModule.ooiPriority = cfgOoiPriority;
		if (this.planet && storageData.destination)
		{
			console.log("...at planet with destination (" + storageData.destination + ") set.");
			this.destination = vgap.getPlanet(storageData.destination);
			// if we are at the destination, clear destination setting
			if (this.destination.id == this.planet.id)
			{
				console.log("We are at destination, clear setting...");
				this.functionModule.handleCargo(this);
				this.destination = false;
				storageData.destination = false;
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
				storageData = autopilot.syncLocalStorage(storageData);
				this.hasToSetPotDes = true;
				//this.functionModule.setPotentialDestinations(this);
			} else
			{
				// planet is not the destination
				console.log("We are at pitstop, set next target...");
				this.setShipTarget(this.destination.x, this.destination.y);
			}
		} else
		{
			if (this.planet)
			{
				console.log("...at planet with no destination set.");
				this.hasToSetPotDes = true;
				//this.functionModule.setPotentialDestinations(this);
			} else
			{
				if (storageData.destination) {
					console.log("...in space with destination (" + storageData.destination + ") set.");
				} else
				{
					console.log("...in space with no destination set.");
					if (this.ship.targetx != this.ship.x || this.ship.targety != this.ship.y) 
					{
						this.hasToSetPotDes = false;
					} else
					{
						this.hasToSetPotDes = true;
					}
					//this.functionModule.setPotentialDestinations(this);
				}
			}
		}
	};
	APS.prototype.getAPSinRange = function(range)
    {
        var lStorage = autopilot.getLocalStorage();
        if (lStorage)
        {
            var pids = [];
            for(var i = 0; i < lStorage.length; i++)
            {
                if (lStorage[i].shipFunction == this.ship.primaryFunction)
                {
                    pids.push(lStorage[i].base);
                }
            }
            var frnnPositions = this.getPositions4Planets(pids);
            return this.getTargetsInRange(frnnPositions, this.base.x, this.base.y, range);
        }
    };
	APS.prototype.getETA = function(tx, ty)
	{
		if (typeof tx == "undefined") tx = this.ship.targetx;
		if (typeof ty == "undefined") ty = this.ship.targety;
		var ETA = 1;
		var maxTurnDist = Math.pow(this.ship.warp,2);
		var journeyDist = Math.floor(this.getDistance({x: this.ship.x, y: this.ship.y}, {x: tx, y: ty}));
		if (journeyDist > maxTurnDist) ETA = Math.ceil(journeyDist / maxTurnDist);
		return ETA;
	};
	/*
	 *  positional information
	 */
	APS.prototype.objectInsideMineField = function(object, friendly, strict)
	{
		if (typeof object == "undefined") return false;
		if (typeof strict == "undefined") strict = false;
        if (typeof friendly == "undefined") friendly = false;
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
			var curDistToMinefieldCenter = Math.floor(this.getDistance({x: mf[i].x, y: mf[i].y}, {x: object.x, y: object.y}));
			if (strict) // only true if we are INSIDE minefield
			{
			    if (friendly) console.log("Object inside friendly minefield.");
				if (mf[i].radius > curDistToMinefieldCenter) return true;
			} else // non-strict, also true if we are too close to a minefield
			{
				if (mf[i].radius > curDistToMinefieldCenter || (curDistToMinefieldCenter - mf[i].radius) < Math.floor(this.simpleRange / 2)) return true;
			}
		}
		return false;
	};
    APS.prototype.objectInsideIonStorm = function(object, strict)
    {
        if (typeof object == "undefined") return false;
        if (typeof strict == "undefined") strict = false;
        var ionStorms = vgap.ionstorms;
        for (var i = 0; i < ionStorms.length; i++)
        {
            var curDistToIonStormCenter = Math.floor(this.getDistance({x: ionStorms[i].x, y: ionStorms[i].y}, {x: object.x, y: object.y}));
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
        if (typeof coords == "undefined") coords = {x: this.ship.x,y: this.ship.y};
        var planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        var closestPlanets = this.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 3);
        if (closestPlanets.length < 1) return false; // if there are no planets within 3 lj, we are not in warp well
        // <= 3 lj distance between planet and ship -> within warp well
        return true;
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
    //
	APS.prototype.isDangerousIonStorm = function(iStorm)
	{
		if (this.getIonStormClass(iStorm) == "dangerous" || this.getIonStormClass(iStorm) == "very dangerous") return true;
		return false;
	}
	APS.prototype.getIonStormClass = function(iStorm)
	{
		if (iStorm.voltage < 50) { return "harmless" }
		else if (iStorm.voltage >= 50 && iStorm.voltage < 100) { return "moderate" }
		else if (iStorm.voltage >= 100 && iStorm.voltage < 150) { return "strong" }
		else if (iStorm.voltage >= 150 && iStorm.voltage < 200) { return "dangerous" }
		else if (iStorm.voltage >= 200) { return "very dangerous" }
		return false;
	};
	APS.prototype.shipHasWeapons = function(ship)
	{
		var shipHull = vgap.getHull(ship.hullid);
		// toDo: the ability to rob the ship, is a weapon. So any privateer ship returns true...
		if (shipHull.beams > 0 || shipHull.fighterbays > 0 || shipHull.launchers > 0)
		{
			return true;
		}
		return false;
	};
	APS.prototype.sortCollection = function(collection, order, direction)
	{
		// default sorting - from low to high (ascending)
		if (typeof direction == "undefined") direction = "asc";
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
	};
	APS.prototype.getOptimalFuelConsumptionEstimate = function(cargo)
	{
		// should not be possible, since warp is set after target selection
		// if (this.ship.warp === 0) return false;
		var hullCargoMass = this.getHullCargoMass(cargo);
		var maxTurnDist = Math.pow(this.ship.warp,2);
		var journeyDist = Math.floor(this.getDistance({x: this.ship.x, y: this.ship.y}, {x: this.ship.targetx, y: this.ship.targety}));
		var penalty = 0; // cloaking or some other additional fuel requironment
		var basicConsumption = vgap.turnFuel(journeyDist, hullCargoMass, this.fFactor, maxTurnDist, penalty);
		//console.log("VGAP Basic consumption: " + basicConsumption);
		//
		var actualConsumption = vgap.turnFuel(journeyDist, hullCargoMass + basicConsumption, this.fFactor, maxTurnDist, penalty);
		//console.log("Actual consumption: " + actualConsumption);
		while (actualConsumption > basicConsumption)
		{
			basicConsumption += 1;
			if (basicConsumption > this.hull.fueltank) return false; // required fuel exceeds tank capacity
			actualConsumption = vgap.turnFuel(journeyDist, hullCargoMass + basicConsumption, this.fFactor, maxTurnDist, penalty);
			//console.log("New actual consumption: " + actualConsumption);
		}
		actualConsumption++;
		//console.log("Estimated minimal consumption to target: " + actualConsumption);
		return actualConsumption;
	};
	APS.prototype.getFuelConsumptionEstimate = function(cargo)
	{
		// estimation how much fuel we would need
		// if cargo is set, use those numbers, if not, use the actual cargo
		var optimalConsumption = this.getOptimalFuelConsumptionEstimate(cargo);
		if (this.functionModule.energyMode == "max") return this.hull.fueltank; // does not need estimate, we will use complete fuel capacity
		if (this.functionModule.energyMode == "moderate") return Math.floor(optimalConsumption * 1.2); // we will use 120 % of optimal consumption
		if (optimalConsumption < 1) {
			return 1;
		} else
		{
			return optimalConsumption;
		}
	};
	APS.prototype.getFutureSurfaceResources = function(planet, turns)
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
	};
	APS.prototype.setWarp = function(warp)
	{
		this.ship.warp = 0;
		if (typeof warp == "undefined") this.ship.warp = this.ship.engineid;
		if (warp > 0 && warp < 10) this.ship.warp = warp;
        // reduce speed to warp 4, if we are currently inside a minefield
        if (this.objectInsideMineField( {x: this.ship.x, y: this.ship.y}, false, true ) && this.ship.engineid > 4) this.ship.warp = 4;
		// set warp 1 if we are moving into or inside warp well
        if (this.isInWarpWell({x: this.ship.targetx, y: this.ship.targety})) this.ship.warp = 1;
		// update fuelFactor
		this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp];
	};
	APS.prototype.getMiningOutput = function(res, turns)
	{
		var resdensity = "density" + res;
		var resground = "ground" + res;
		if (typeof turns == "undefined") turns = 1;
		// toDo: lizardEffektor = ...
		var theoreticalOutput = turns * Math.floor(this.planet.mines * this.planet[resdensity]);
		if (theoreticalOutput <= this.planet[resground])
		{
			return theoreticalOutput;
		} else
		{
			return this.planet[resground];
		}
	};
	APS.prototype.getDistance = function(p1, p2)
	{
		return Math.sqrt((Math.pow((parseInt(p1.x) - parseInt(p2.x)),2) + Math.pow((parseInt(p1.y) - parseInt(p2.y)),2)));
	};
	APS.prototype.getHullCargoMass = function(cargo)
	{
		var hullCargoMass = this.hull.mass;
		var maxHullCargoMass = this.hull.mass + this.hull.cargo;
		if (typeof cargo !== "undefined" && cargo.length > 0)
		{
			cargo.forEach(function(comp) { hullCargoMass += parseInt(comp); });
			if (hullCargoMass > maxHullCargoMass) hullCargoMass = maxHullCargoMass;
		} else
		{
			var components = [
				this.ship.duranium,
				this.ship.tritanium,
				this.ship.molybdenum,
				this.ship.supplies,
				this.ship.ammo, // torpedos or fighters
				this.ship.clans
			];
			components.forEach(function(comp) { hullCargoMass += parseInt(comp); });
		}
		//console.log("APS hull cargo mass: " + hullCargoMass);
		return hullCargoMass;
	};
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
	/*
	 *  mission specifics
	 */
	APS.prototype.evaluateMissionDestinations = function()
	{
		// pre filter destinations (e.g. remove destinations located in problematic zones)
		var filteredDest = [];
		var avoidDest = [];
		console.log("prefiltering destinations: " + this.potDest.length);
		for (var i = 0; i < this.potDest.length; i++)
		{
			var potPlanet = vgap.getPlanet(this.potDest[i].pid);
			var hasBase = vgap.getStarbase(this.potDest[i].pid);
			if (this.planet && potPlanet.id == this.planet.id) continue;
			// don't use prospected base planets
			if (potPlanet.note && potPlanet.note.body.match(/nup:base/))
			{
				console.log("...removing destinations: " + potPlanet.id + " - a base will be built here!");
				continue;
			}
			// if destination has a starbases but is not the APS' base
			if (hasBase && hasBase.planetid != this.base.id)
			{
				// reject potential destination unless APS is distributing clans
				if (this.primaryFunction != "dis" && this.objectOfInterest != "cla")
				{
					console.log("...removing destinations: " + potPlanet.id + " because it is a base of operations!");
					continue;
				}
			}
			// this should/may be moved to the potential destination selection process
			// only use destinations that offer enough minerals
			if (this.functionModule.ooiPriority != "mcs" && this.primaryFunction == "col")
			{
				// too little resources available
				var futRes = this.getFutureSurfaceResources(potPlanet, this.getETA(potPlanet.x, potPlanet.y));
				var minimal = Math.floor(parseInt(this.hull.cargo) * this.functionModule.minimalCargoRatioToGo);
				//console.log("Resources on potential target (in " + this.getETA(potPlanet.x, potPlanet.y) + " turns): " + futRes.buildRes);
				if (futRes.buildRes < minimal) {
					console.log("...removing destinations: " + potPlanet.id + " due to lack of resources (" + futRes.buildRes + " / " + minimal + ")!");
					continue;
				}
			}
			if (this.getMissionConflict(potPlanet))
			{
				console.log("removing destinations: " + potPlanet.id + " due to mission conflict...");
				continue;
			}
			// lastly... if potential destination is unsave... add potPlanet to avoidList which will be appended to the filtered list
			if (!this.isSavePosition(potPlanet)) // minefields, enemies, ionstorms...
			{
				// move this potPlanet to the end of the array
				avoidDest.push(this.potDest[i]);
				continue;
			}
			filteredDest.push(this.potDest[i]);
		}
		console.log("Remaining destinations: " + filteredDest.length);
		if (avoidDest.length > 0)
		{
			console.log("Adding avoid-destinations: " + avoidDest.length);
			filteredDest.push(avoidDest);
		}
		return filteredDest;
	};
	APS.prototype.updateMissionControl = function()
	{
		this.functionModule.updateMission(this);
	};
	APS.prototype.confirmMission = function()
	{
		this.functionModule.confirmMission(this);
	};
	APS.prototype.getMissionConflict = function(potPlanet)
	{
		//
		// Check if potential destination is in the APS control list
		var storeId = "nuPilot" + vgap.game.createdby + vgap.game.id;
		var storedGameData = JSON.parse(localStorage.getItem(storeId));
		if (storedGameData === null)
		{
			// no storage setup yet
			console.log("Couldn't read stored game data...");
			return false;
		} else
		{
			for(var i = 0; i < storedGameData.length; i++)
			{
				var curShip = vgap.getShip(storedGameData[i].sid);
				if (curShip)
				{
					// location of current storage APS
					var curShipPlanet = vgap.planetAt(curShip.x, curShip.y);
					// if location is potential target of current APS and has the same primary function as storage APS
					if (curShipPlanet && curShipPlanet.id == potPlanet.id && this.primaryFunction == storedGameData[i].shipFunction)
					{
						// if the primary function is expansion and the potential target is NOT a source Planet
						if (this.primaryFunction == "exp" && !this.functionModule.isSource(potPlanet))
						{
							// reject
							return true;
						}
					}
				}
				//var mDestination = vgap.getPlanet(mission[j].pid);
				if (storedGameData[i].sid == this.ship.id) continue; // skip data from current APS
				if (storedGameData[i].destination == potPlanet.id)
				{
					console.warn("Potential destination is already mission destination of another APS!");
					if (storedGameData[i].shipFunction == this.primaryFunction && storedGameData[i].ooiPriority == this.objectOfInterest)
					{
						if (this.primaryFunction == "exp" && !this.functionModule.isSource(potPlanet))
						{
							// reject
							return true;
						} else if (this.primaryFunction != "exp")
						{
							// the destination is invalid
							//   if it is part of a mission
							//   unless the primary function of the APS is a different one...
							// toDo: reconsider
							//   - if the planet has more resourcen than one APS can carry
							//   - if mines will surface enough until ETA
							//   - if another APS will drop something off... etc.
							//   -
							return true;
						}
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
			if (this.destination)
			{
				destination = "(" + this.destination.id + ")";
			}
			if (this.primaryFunction == "col")
			{
				note.body = this.primaryFunction + " -> " + this.objectOfInterest + " -> " + this.base.id + destination;
			} else
			{
				note.body = this.primaryFunction + " -> " + this.objectOfInterest + destination;
			}
		} else
		{
			note.body = "";
		}
	};
	/*
	 *  target selection specifics
	 */
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
		var returnIfSmaller = -1;
		var returnIfBigger = 1;
		if (direction == "desc")
		{
			// sorting from high to low
			returnIfSmaller = 1;
			returnIfBigger = -1;
		}
		pileA.sort(
			function(a, b)
			{
				var x = a[order];
				var y = b[order];
				if (x < y) {return returnIfSmaller;}
				if (x > y) {return returnIfBigger;}
				return 0;
			}
		);
		pileB.sort(
			function(a, b)
			{
				var x = a[order];
				var y = b[order];
				if (x < y) {return returnIfSmaller;}
				if (x > y) {return returnIfBigger;}
				return 0;
			}
		);
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
				devideThresh = 5000;
			} else
			{
				devideThresh = Math.floor(this.hull.cargo * this.functionModule.minimalCargoRatioToGo);
			}
		}
		return devideThresh;
	};
	APS.prototype.getTargetsInRange = function(coords, x, y, r)
	{
		var frnn = new FRNN(coords, r);
		var inRange = frnn.inRange({x: x,y: y}, r);
		return inRange;
	};
	APS.prototype.getTurnTargets = function(ship, destination, adjustment)
	{
	    // TurnTargets: x, y, distance(toDestination), planetId
		var frnnTargets = [];
		if (this.primaryFunction == "exp")
		{
			frnnTargets = autopilot.frnnUnownedPlanets;
		} else
		{
			frnnTargets = autopilot.frnnOwnPlanets;
		}
		var turnTargets = this.getTargetsInRange(frnnTargets, ship.x, ship.y, (this.simpleRange + adjustment));
		for (var i = 0; i < turnTargets.length; i++)
		{
			var tt = turnTargets[i];
			// distance between potential next stop and the destination
			//  - in case the potential next stop is the destination, distance is 0
            turnTargets[i].distance = this.getDistance({x: tt.x , y: tt.y}, {x: destination.x , y: destination.y});
            var ttPlanet = vgap.planetAt(tt.x , tt.y);
            turnTargets[i].pid = ttPlanet.id;
		}
		// sort the targets by distance
		turnTargets.sort(function(a, b) {
				var x = a.distance;
				var y = b.distance;
				if (x < y) {return -1;}
				if (x > y) {return 1;}
				return 0;
			});
		return turnTargets;
	};
    APS.prototype.isSaveShipTarget = function(x, y, pid)
    {
        return this.isSavePosition({ x: x, y: y , pid: pid});
    };
    APS.prototype.isSavePosition = function(pos)
    {
        // don't visit planets in or close to minefields
        // toDo: planets in radiation zones, if you don't have special shielding
        if (this.objectInsideMineField(pos))
        {
            console.log("...position is inside / close to minefield!");
            return false;
        }
        // don't visit planets close to enemy planets or ships
        // except planets that are base planets and planets protected by friendly minefield
        if (this.objectInRangeOfEnemy(pos) && !this.objectInsideMineField(pos,true,true))
        {
            return false;
        }
        var ionStormId = false;
        if ((ionStormId = this.objectInsideIonStorm(pos)))
        {
            if (this.isDangerousIonStorm(ionStormId))
            {
                console.log("...position is inside / close to dangerous ionstorm...");
                return false;
            }
        }
        return true;
    };
    APS.prototype.objectInRangeOfEnemy = function(object)
    {
        // in range of enemy ships
        // in range of enemy planet
        // in range = 1 turn movement
        if (typeof object == "undefined") return true;
        var curDistToEnemy = 0;
        var eP = autopilot.frnnEnemyPlanets;
        for (var i = 0; i < eP.length; i++)
        {
            curDistToEnemy = this.getDistance({x: eP[i].x, y: eP[i].y}, {x: object.x, y: object.y});
            // prevent ships from getting to close to enemy planets while traveling to destination
            // ignore when object is the base planet
            if (curDistToEnemy < this.functionModule.enemySafetyZone && object.pid != this.base.id)
            {
                console.log("...position (" + object.pid + ":" + object.x + "x" + object.y + ") is in range of enemy planet!");
                return true;
            }
        }
        var eS = autopilot.frnnEnemyShips;
        for (var j = 0; j < eS.length; j++)
        {
            curDistToEnemy = this.getDistance({x: eS[j].x, y: eS[j].y}, {x: object.x, y: object.y});
            // prevent ships from getting to close to enemy ships while traveling to destination
            // ignore when ship has no weapons toDo: danger of robbing?
            // ignore when object is the base planet
            curShip = vgap.getShip(eS[j].sid);
            if (curDistToEnemy < this.functionModule.enemySafetyZone && this.shipHasWeapons(curShip) && object.pid != this.base.id)
            {
                console.log("...position (" + object.x + "/" + object.y + ") is in range (" + curDistToEnemy + " lj) of enemy ship - (" + eS[j].x + "/" + eS[j].y + ")!");
                return true;
            }
        }
        return false;
    };
	// interaction specifics
	APS.prototype.checkFuel = function()
	{
		if (this.planet && this.planet.ownerid == vgap.player.id)
		{
			this.setWarp(); // set most efficient warp factor for fuel consumption estimation
			var fuel = Math.floor(this.getFuelConsumptionEstimate() * 1.5); // use more, so there will be enough for return trip
			var loadedFuel = this.loadObject("neutronium", this.planet, fuel);
			console.log("We have " + loadedFuel + " neutronium aboard and need " + fuel);
			if (loadedFuel >= fuel)
			{
				return true;
			} else
			{
				// there is not enough fuel!
				var shortage = fuel - loadedFuel;
				var futureFuel = this.planet.neutronium + this.getMiningOutput("neutronium", 2);
				if (futureFuel >= shortage)
				{
					// if there will be enough in 2 turns, lets wait
					console.log("Waiting for enough fuel (" + shortage + ") to be available (" + futureFuel + ")...");
					this.setWarp(0);
					return false;
				} else
				{
					this.setWarp(0);
					return false; // consider other options
				}
			}
		} else
		{
			// in space...
			this.setWarp(); // set most efficient warp factor
			return true;
		}
	};
	APS.prototype.unloadFuel = function()
	{
		if (this.planet)
		{
			var amount = parseInt(this.ship.neutronium) - 1;
			var onShip = this.unloadObject("neutronium", this.planet, amount);
		}
	};
	APS.prototype.unloadCargo = function()
	{
		if (this.planet)
		{
			var unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
			for (var i = 0; i < unloadingSequence.length; i++)
			{
				var cargo = unloadingSequence[i];
				var onShip = 0;
				if (this.planet.ownerid == vgap.player.id)
				{
					onShip = this.unloadObject(cargo, this.planet, parseInt(this.ship[cargo]));
				} else
				{
					onShip = this.transferObject(cargo, this.planet, parseInt(this.ship[cargo]));
				}
			}
		}
	};
	APS.prototype.loadMegacredits = function(from, amount)
	{
		if (typeof amount == "undefined") amount = from.megacredits;
		if (this.ship.megacredits >= amount) return;
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
		this.ship.changed = 1;
		from.changed = 1;
	};
	APS.prototype.unloadObject = function(object, to, amount)
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
		// now unload, planets have unlimited cpacity... no need to check
		this.ship[object] -= actAmount;
		to[object] += actAmount;
		this.ship.changed = 1;
		to.changed = 1;
		// return actAmount;
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
		this.ship.changed = 1;
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
		} else {
			// if it is defined use it, unless...
			actAmount = amount;
			// ...amount is more than what is available, then only load the latter amount
			if (amount > from[object]) actAmount = from[object];
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
	/*
	 * set next stop to destination x, y
	 */
	APS.prototype.setShipTarget = function(x, y)
	{
		if (!this.destination)
		{
			var dest = vgap.planetAt(x, y);
			if (dest)
			{
				console.warn("Setting new APS DESTINATION!");
				this.setShipDestination(x, y);
			} else
			{
                console.warn("Destination is not a planet!");
				return;
			}
		} else
		{
			console.warn("Destination of APS already set: " + this.destination.name);
		}
		var destinationPlanet = vgap.planetAt(x, y);
		console.log("Searching target on the way to " + destinationPlanet.name + " (" + destinationPlanet.id + ")...");
		var adjustment = 0;
		var turnTargets = this.getTurnTargets(this.ship, destinationPlanet, adjustment);
		// distance from current location to destination planet
		var curPosDistance = Math.floor(this.getDistance({x: this.ship.x , y: this.ship.y}, {x: x , y: y}));
		//
		console.log("Turntargets: " + adjustment);
        console.log(turnTargets);
		//console.log(turnTargets);
		//
		while(turnTargets.length === 0 || turnTargets[0].distance >= (curPosDistance * 0.9)) // only use targets that are (considerably? 10 %?) closer to the destination than the current position
		{
			adjustment += 10;
			if (adjustment > 500) break;
			turnTargets = this.getTurnTargets(this.ship, destinationPlanet, adjustment);
			console.log("...found " + turnTargets.length + " turn-targets within a " + (this.simpleRange + adjustment) + " ly radius...");
		}
		if (turnTargets.length > 0)
		{
			if (this.isSaveShipTarget(turnTargets[0].x, turnTargets[0].y, turnTargets[0].pid))
			{
				this.ship.targetx = turnTargets[0].x;
				this.ship.targety = turnTargets[0].y;
			} else
			{
				// toDo... if danger is closing in on current position... flee
				//
				if (turnTargets.length > 1)
				{
					console.log("Current target is unsave... try one alternative...");
					if (this.isSaveShipTarget(turnTargets[1].x, turnTargets[1].y, turnTargets[1].pid))
					{
						this.ship.targetx = turnTargets[1].x;
						this.ship.targety = turnTargets[1].y;
					} else
					{
						console.log("Primary and alternative targets are unsave...");
						if (this.isInWarpWell())
                        {
                            console.log("We are in warp well...");
                            // toDo: do we have to move? are there enemy ships close by?
                        } else
                        {
                            console.log("Moving into warp well...");
                            var coords = this.getRandomWarpWellEntryPosition();
                            this.ship.targetx = coords.x;
                            this.ship.targety = coords.y;
                        }
					}
				} else
				{
				    // toDo: no turntargets... should be almost impossible... if player has only 1 planet left?
					console.log("No turn targets... stay at current position...");
					this.ship.targetx = this.ship.x;
					this.ship.targety = this.ship.y;
				}
			}
		}
	};
	APS.prototype.updateStoredData = function()
    {
        this.storedData = {
            sid: this.ship.id,
            base: this.base.id,
            destination: this.destination.id,
            shipFunction: this.primaryFunction,
            ooiPriority: this.functionModule.ooiPriority,
            idle: this.isIdle
        };
        autopilot.syncLocalStorage(this.storedData);
    };
	APS.prototype.setShipDestination = function(x, y)
	{
		this.destination = vgap.planetAt(x, y);
        this.updateStoredData();
	};
	APS.prototype.isValidDestination = function(destination)
	{
		if (destination)
		{
			var destPlanet = vgap.getPlanet(destination);
			if (destPlanet) return (destPlanet.ownerid == vgap.player.id);
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
	// Ship specifics
	APS.prototype.getShipConfig = function (note)
	{
		return note.match(/nup:b:(\d+):(col|dis):(neu|dur|tri|mol|all|mcs|cla)/);
		// toDo: return a nice object
	};
	APS.prototype.getShipMass = function(cargo)
	{
		var shipMass = 0;
		var components = [];
		if (typeof cargo !== "undefined" && cargo.length > 0)
		{
			components = cargo;
		} else
		{
			components = [
				this.hull.mass,
				this.ship.neutronium,
				this.ship.duranium,
				this.ship.tritanium,
				this.ship.molybdenum,
				this.ship.supplies,
				this.ship.ammo, // torpedos or fighters
				this.ship.clans
			];
		}
		components.forEach(function(comp) { shipMass += parseInt(comp); });
		return shipMass;
	};
	APS.prototype.setRange = function()
	{
		this.maxRange = this.getShipRange(false, [this.hull.mass, this.hull.cargo], this.hull.fueltank);
		this.simpleRange = Math.pow(this.ship.warp,2); // max turn distance
		if (this.gravitonic) this.simpleRange *= 2;
		if (this.maxRange > 0) this.defaultFixedRadius = Math.floor(this.simpleRange * 2); // changed 19.12.16 from half the max range to 2 * simple range
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
		frnnPlanets: [],
		frnnOwnPlanets: [],
		frnnEnemyMinefields: [],
        frnnFriendlyMinefields: [],
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
		populateFrnnCollections: function()
		{
			autopilot.populateFrnnPlanets();
			autopilot.populateFrnnMinefields();
			autopilot.populateFrnnShips();
		},
		populateFrnnMinefields: function()
		{
			autopilot.frnnEnemyMinefields = [];
			autopilot.frnnFriendlyMinefields = [];
			vgap.minefields.forEach(function(minefield) {
				if (minefield.ownerid != vgap.player.id && !autopilot.isAlly(minefield.ownerid))
				{
					autopilot.frnnEnemyMinefields.push({x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid});
				} else {
                    autopilot.frnnFriendlyMinefields.push({x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid});
                }
			});
		},
		isAlly: function(playerId)
		{
			for (var i = 0; i < vgap.relations.length; i++)
			{
				if (vgap.relations[i].playertoid == playerId)
				{
					if (vgap.relations[i].relationto > 2)
					{
						return true;
					} else
					{
						return false;
					}
				}
			}
		},
		populateFrnnShips: function()
		{
			autopilot.frnnEnemyShips = [];
			vgap.ships.forEach(function(ship) {
				// toDo: allies, consider heading
				if (ship.ownerid != vgap.player.id && !autopilot.isAlly(ship.ownerid))
				{
					autopilot.frnnEnemyShips.push({sid: ship.id, x: ship.x, y: ship.y});
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
				if (planet.ownerid > 0 && planet.ownerid == vgap.player.id) autopilot.frnnOwnPlanets.push({x: planet.x, y: planet.y});
				if (planet.ownerid > 0 && planet.ownerid != vgap.player.id && !autopilot.isAlly(planet.ownerid))
				{
					autopilot.frnnEnemyPlanets.push({x: planet.x, y: planet.y});
				}
				// toDo: ownerid === 0 = unowned? or also unknown owner?
				if (planet.ownerid === 0) autopilot.frnnUnownedPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
			});
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
			// use targetmines instead of mines to react to planeteer plugin behaviour
			var pStructures = [
				{ structures: "mines", n: planet.targetmines, thresh: 200 },
				{ structures: "factories", n: planet.factories, thresh: 100 },
				{ structures: "defense", n: planet.defense, thresh: 50 }
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
				minimalClans = curThresh + Math.pow(extraStructures, 2);
				freeClans = planet.clans - minimalClans;
			} else
			{
				freeClans = planet.clans - curStructures;
			}
			return freeClans;
		},
		getFreeClans: function(planet)
		{
			var mines = planet.mines;
			var factories = planet.factories;
			var defense = planet.defense;
			if (planet.targetmines > planet.mines) mines = planet.targetmines;
			if (planet.targetfactories > planet.factories) mines = planet.targetfactories;
			if (planet.targetdefense > planet.defense) mines = planet.targetdefense;
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
				minimalClans = curThresh + Math.pow(extraStructures, 2);
				freeClans = planet.clans - minimalClans;
			} else
			{
				freeClans = planet.clans - curStructures;
			}
			//
			var natFreeClans = 0;
			if (planet.nativeclans > 0)
			{
				// clans we need to receive full supply from Bovinoids
				var bovSupClans = 0;
				// clans we need to receive full taxes from natives
				var natTaxClans = autopilot.getNativeTaxClans(planet);

				if (planet.nativeracename == "Bovinoid")
				{
					bovSupClans = Math.floor(planet.nativeclans / 100);
				}
				// the more clans we need, the less are freeClans
				if (natTaxClans > bovSupClans)
				{
					natFreeClans = planet.clans - natTaxClans;
				} else
				{
					natFreeClans = planet.clans - bovSupClans;
				}
			}
			if (planet.nativeclans > 0 && freeClans > natFreeClans)
			{
				console.log("Planet " + planet.id + " free clans: " + natFreeClans);
				return natFreeClans;
			} else
			{
				console.log("Planet " + planet.id + " free clans: " + freeClans);
				return freeClans;
			}
		},
		getClanDeficiency: function(planet)
		{
			// clan deficiencies...
			var deficiency = 0;
			var natDef = 0;
			if (planet.nativeclans > 0) natDef = autopilot.getNativeTaxClanDeficiency(planet);
			var bovDef = 0;
			if (planet.nativeracename == "Bovinoid") bovDef = autopilot.getBovinoidSupClanDeficiency(planet);
			//
			var bldDef = autopilot.getBuildingClanDeficiency(planet);
			var allDef = [natDef, bovDef, bldDef];
			allDef.sort(function(a, b) { return a-b; });
			// get most severe deficiency
			deficiency = allDef[0];
			//
			maxPop = autopilot.getMaxColonistPopulation(planet);
			if ((deficiency * -1) + planet.clans > maxPop)
			{
				deficiency = (maxPop - planet.clans) * -1;
			}
			return Math.floor(deficiency);
		},
		getFuelDeficiency: function(planet)
		{
			// neutronium deficiencies...
			// toDo: if planet has a base = 500, if not 100
			var fuelRetentionMass = 100; // global setting
			var deficiency = 0;
			var neu = parseInt(planet.neutronium);
			var gneu = parseInt(planet.groundneutronium);
			var dneu = parseInt(planet.densityneutronium);
			if (planet.mines > 0 && gneu > 10)
			{
				var neuMining = Math.floor(planet.mines * (dneu / 100));
				if (gneu >= neuMining)
				{
					deficiency = neu + neuMining - fuelRetentionMass;
				} else
				{
					deficiency = neu + gneu - fuelRetentionMass;
				}
			} else
			{
				deficiency = neu - fuelRetentionMass;
			}
			return Math.floor(deficiency);
		},
		getMcDeficiency: function(planet)
		{
			var deficiency = 0;
			var tfdef = parseInt(planet.targetfactories) - parseInt(planet.factories);
			var tmdef = parseInt(planet.targetmines) - parseInt(planet.mines);
			var tddef = parseInt(planet.targetdefense) - parseInt(planet.defense);
			if (tfdef > 0) deficiency += (tfdef * 3);
			if (tmdef > 0) deficiency += (tmdef * 4);
			if (tddef > 0) deficiency += (tddef * 10);
			deficiency = parseInt(planet.megacredits) - deficiency;
			return deficiency;
		},
		getAvailability: function(planet, object)
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
			}
			return 0;
		},
		collectSourceSinkData: function(planet)
		{
			autopilot.clanSources = [];
			autopilot.neuSources = [];
			autopilot.mcSources = [];
			autopilot.clanDeficiencies = [];
			autopilot.neuDeficiencies = [];
			autopilot.mcDeficiencies = [];
			vgap.planets.forEach(function(planet) {
				if (planet.ownerid == vgap.player.id)
				{
					// clan sink (-) or source (+)
					var def = autopilot.getClanDeficiency(planet);
					if (def >= 0)
					{
						def = autopilot.getFreeClans(planet);
						if (def > 50 && planet.nativeracename != "Amorphous") autopilot.clanSources.push({pid: planet.id, value: def});
					} else
					{
						autopilot.clanDeficiencies.push({pid: planet.id, deficiency: def});
					}
					// neutronium sources...
					def = autopilot.getFuelDeficiency(planet);
					if (def >= 0)
					{
						if (def > 50) autopilot.neuSources.push({pid: planet.id, value: def});
					} else
					{
						autopilot.neuDeficiencies.push({pid: planet.id, deficiency: def});
					}
					// megacredit sources...
					def = autopilot.getMcDeficiency(planet);
					if (def >= 0)
					{
						if (def > 500) autopilot.mcSources.push({pid: planet.id, value: def});
					} else
					{
						autopilot.mcDeficiencies.push({pid: planet.id, deficiency: def});
					}
				}
			});
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
				var race = this.ownerForPlanet(planet);
				if (race == 7)
				{
					return (planet.temp * 1000);
				} else if (planet.temp > 80 && (race == 4 || race == 9 || race == 10 || race == 11)) // desert worlds
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
				var race = this.ownerForPlanet(planet);
				if (race == 6) if (taxRate > 20) taxRate = 20;
				var income = planet.nativeclans * (taxRate / 100) * (planet.nativegovernment / 5) / 10;
				if (planet.nativeracename == "Insectoid") income *= 2;
				if (race == 1) income *= 2;
				if (race == 12) income = planet.nativeclans;
				if (income > this.MaxIncome) income = this.MaxIncome;
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
		isInStorage: function(shipId)
		{
			var storeId = "nuPilot" + vgap.game.createdby + vgap.game.id;
			var storedGameData = JSON.parse(localStorage.getItem(storeId));
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
						return storedGameData[i];
					}
				}
			}
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
				ship.note.body = "";
			}
		},
        getLocalStorage: function()
        {
            // each game has a different storage
            var storeId = "nuPilot" + vgap.game.createdby + vgap.game.id;
            var storedGameData = JSON.parse(localStorage.getItem(storeId));
            if (storedGameData === null) // no storage setup yet
            {
                return false;
            } else {
                return storedGameData;
            }
        },
		syncLocalStorage: function(data, update)
		{
			if (typeof update == "undefined") update = false;
            // each game has a different storage
            var storeId = "nuPilot" + vgap.game.createdby + vgap.game.id;
			// load data
			var storedGameData = autopilot.getLocalStorage();
			if (!storedGameData) // no storage setup yet
			{
				if (data.ooiPriority == "END") return false; // if turned off 
				storedGameData = [];
				// set defaults (not set in inital data)
				if (typeof data.destination == "undefined") data.destination = false;
				if (typeof data.newFunction == "undefined") data.newFunction = false;
				if (typeof data.newOoiPriority == "undefined") data.newOoiPriority = false;
                if (typeof data.idle == "undefined") data.idle = false;
				storedGameData.push(data);
				// save data
				localStorage.setItem(storeId, JSON.stringify(storedGameData));
				//
				return data;
			} else
			{
				// storage available...
				for(var i = 0; i < storedGameData.length; i++)
				{
					// ...look for entry of the current APS
					if (storedGameData[i].sid == data.sid)
					{
						// if turned off
						if (data.ooiPriority == "END")
						{
							storedGameData.splice(i, 1); // delete entry
							autopilot.clearShipTarget(data.sid);
							autopilot.clearShipNote(data.sid); // toDO: not working
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
							// if destination is provided, update
                            if (data.idle && storedGameData[i].idle != data.idle) storedGameData[i].idle = data.idle;
							if (typeof data.destination != "undefined") storedGameData[i].destination = data.destination;
						}
						localStorage.setItem(storeId, JSON.stringify(storedGameData));
						return storedGameData[i];
					}
				}
				// no data for specific APS available
				//
				// set defaults (not set in inital data)
				if (typeof data.destination == "undefined") data.destination = false;
				if (typeof data.newFunction == "undefined") data.newFunction = false;
				if (typeof data.newOoiPriority == "undefined") data.newOoiPriority = false;
                if (typeof data.idle == "undefined") data.idle = false;
				storedGameData.push(data);
				localStorage.setItem(storeId, JSON.stringify(storedGameData));
				return data;
			}
		},
		setupAPS: function(shipId, cfgData)
		{
			console.log("Setting up new APS " + shipId);
			var ship = vgap.getShip(shipId);
			var aps = new APS(ship, cfgData);
			if (aps.isAPS)
			{
				if (aps.hasToSetPotDes)
				{
					console.error("Set potential destinations for APS " + aps.ship.id);
					aps.functionModule.setPotentialDestinations(aps);
				}
				aps.updateMissionControl();
				aps.confirmMission();
				aps.updateNote();
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
			//autopilot.storage = window.localStorage;
			if (typeof(localStorage) !== "undefined") {
				//console.log(localStorage); // Code for localStorage/sessionStorage.
			} else {
				console.warn("Sorry! No Web Storage support..");
			}
			// toDo: return if an old turn is loaded?
			autopilot.populateFrnnCollections();
			// scan ship notes for APS instructions
			console.log(vgap);
			var apsControl = [];
			apsLocations = [];
			vgap.myships.forEach(function(ship) {
				var aps = {};
				var cfgData = autopilot.isInStorage(ship.id);
				if (cfgData)
				{
					// if configuration is available in storage
					aps = new APS(ship, cfgData);
				}
				if (aps.isAPS)
				{
					// add APS to APS-list
					apsControl.push(aps);
				}
			});
			// ships that arrived at destination have been unloaded...
			autopilot.collectSourceSinkData();
			apsControl.forEach(function(shipcontrol) {
				if (shipcontrol.hasToSetPotDes)
				{
					console.error("Set potential destinations for APS " + shipcontrol.ship.id);
					shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
				}
			});
			//
			// after we have initialized the APS,
			//   - we have potential destinations or already have our next target logged in...
			//	 - we now need to finalize everything:
			//	   - log in destination conidering additional info from mission control
			//	   - load / unload
			//	   - check fuel and warp... go
			//
			//  toDo: move all loading unloadig in finale round
			apsControl.forEach(function(shipcontrol) {
				console.error("Updating mission of APS " + shipcontrol.ship.id);
				// setting up a brief mission list for ship-ship coordination
				//
				shipcontrol.updateMissionControl();
				//
				shipcontrol.confirmMission();
				shipcontrol.updateNote();
				//console.log(autopilot.apsMissions);
				// collect info and evaluate optimization possibiities...
			});
			apsControl.forEach(function(shipcontrol)
			{
				// retry idle ships
                if (shipcontrol.isIdle)
                {
                    console.error("Retry idle ship " + shipcontrol.ship.id);
                    if (!shipcontrol.destination)
                    {
                        shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                    }
                    shipcontrol.updateMissionControl();
                    shipcontrol.confirmMission();
                    shipcontrol.updateNote();
                }
            });
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
			//console.log("LoadPlanet: plugin called.");
			//console.log("Planet id: " + vgap.planetScreen.planet.id);
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
			//console.log("LoadShip: plugin called.");
			//console.log("Ship id: " + vgap.shipScreen.ship.id);
			//console.log("Ship coordinates: " + vgap.shipScreen.ship.x + "/" + vgap.shipScreen.ship.y);
			//console.log("Ship name: " + vgap.shipScreen.ship.name);
			//console.log("Ship hull: " + vgap.shipScreen.ship.hullid);
		},
	};
	// register your plugin with NU
	vgap.registerPlugin(autopilot, "autopilotPlugin");
} //wrapper for injection

var script = document.createElement("script");
script.type = "application/javascript";
script.textContent = "(" + wrapper + ")();";

document.body.appendChild(script);
