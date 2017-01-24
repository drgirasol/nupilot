// ==UserScript==
// @name          nuPilot
// @description   Planets.nu plugin to enable semi-intelligent auto-pilots
// @version       0.06.98
// @date          2017-01-08
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
				ooiOptions: [ "neu", "cla", "sup", "mcs" ],
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
						    var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
						    if (!cfgData)
                            {
                                var baseId = 0; // todo: closest owned planet
                                var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                if (planet) baseId = planet.id;
                                var data = { sid: vgap.shipScreen.ship.id, base: baseId, shipFunction: g, ooiPriority: h };
                                cfgData = autopilot.syncLocalStorage(data); // will get default cfgData (=data)
                                if (h != "END") autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData);
                            } else {
						        cfgData.shipFunction = g;
						        cfgData.ooiPriority = h;
                                cfgData = autopilot.syncLocalStorage(cfgData); // will get default cfgData (=data)
                                if (h != "END") autopilot.updateAPS(vgap.shipScreen.ship.id, cfgData);
                            }
							return false;
						};
					};
					$("<a style='color:cyan;font-size: 10px;'>" + c.ooiOptions[j] + " </a>").tclick(clickf(c.shipFunction, c.ooiOptions[j])).appendTo("#ooiPriority" + c.shipFunction);
				}
			} else
			{
				var d = function(g, h) {
					return function() {
                        var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                        if (!cfgData) {
                            var baseId = 0; // todo: closest owned planet
                            var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                            if (planet) baseId = planet.id;
                            var data = {sid: vgap.shipScreen.ship.id, base: baseId, shipFunction: g, ooiPriority: h};
                            cfgData = autopilot.syncLocalStorage(data);
                            if (h != "END") autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData);
                        } else {
                            cfgData.shipFunction = g;
                            cfgData.ooiPriority = h;
                            cfgData = autopilot.syncLocalStorage(cfgData); // will get default cfgData (=data)
                            if (h != "END") autopilot.updateAPS(vgap.shipScreen.ship.id, cfgData);
                        }
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
    alchemyAPS.prototype.setPotentialTurnTargets = function(aps)
    {
        aps.turnTargets = autopilot.frnnOwnPlanets;
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
		var curCargo = 0;
		curCargo += aps.loadObject("supplies", aps.planet);
		return curCargo;
	};
	/*
	 * Autopilot - Expansion Module
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
        var k = 0;
        var range = parseInt(aps.simpleRange);
        var targetsInRange = [];
        //var targetsInRange = aps.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.base.x, aps.base.y, aps.simpleRange*k);
        while(targetsInRange.length < 1)
        {
            k++;
            if (k > 20) break;
            targetsInRange = aps.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.base.x, aps.base.y, (range * k));
            console.log("... potential targets: " + targetsInRange.length + " (" + (range * k) + ")");
            if (targetsInRange.length > 0)
            {
                for (var i = 0; i < targetsInRange.length; i++)
                {
                    var shipsAtSink = vgap.shipsAt(targetsInRange[i].x, targetsInRange[i].y);
                    var p = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
                    if (shipsAtSink.length > 0)
                    {
                        console.log("... there are ships at sink... removing planet " + p.id);
                        targetsInRange.splice(i, 1);
                    }
                }
            }
        }
        var amorph = [];
        var potential = [];
		for (var i = 0; i < targetsInRange.length; i++)
		{
			var sP = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
			var distance = Math.floor(aps.getDistance({x: sP.x, y: sP.y}, {x:aps.ship.x ,y:aps.ship.y}));
            var deficiency = 150;
            if (sP.temp > -1) deficiency = autopilot.getMaxColonistPopulation(sP) * -1;
            //
            this.frnnSinks.push({x: sP.x, y: sP.y}); // redundant?
            //
            if (sP.nativeracename == "Amorphous")
            {
                console.log("... there are amorphous natives living on " + sP.id + " ... sorting to the back...");
                amorph.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency });
                continue;
            }
            potential.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency });
		}
        this.sinks = aps.sortCollection(potential, "distance");
        if (amorph.length > 0)
        {
            // putting amorph planets to the end of the line...
            this.sinks.concat(amorph);
        }
	};
	expanderAPS.prototype.setSources = function(aps)
	{
		// sources are the same as for a clan distributer...
        // toDo: ...except that also supplies and MCs are needed!
		this.sources = autopilot.clanSources;
		//console.log(autopilot.clanSources);
        //console.log(autopilot.clanDeficiencies);
		for (var i = 0; i < this.sources.length; i++)
		{
			var sourcePlanet = vgap.getPlanet(this.sources[i].pid);
			//
			this.frnnSources.push({x: sourcePlanet.x, y: sourcePlanet.y}); // redundant ?
			//
			var distance = Math.floor(aps.getDistance({x: sourcePlanet.x, y: sourcePlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			// update deficiencies (...unloading has occured)
			var value = autopilot.getFreeClans(sourcePlanet);
			if (value < 500) value = 0; // only higly over-populated planets are considered sources
			this.sources[i].value = value;
			this.sources[i].distance = distance;
			this.sources[i].x = sourcePlanet.x;
			this.sources[i].y = sourcePlanet.y;
		}
		// priorities by degree of value (split)... and sort splits by value
		this.sources = aps.getDevidedCollection(this.sources, "value", this.devideThresh, "value", "desc");
		//console.log(this.sources);
	};
	expanderAPS.prototype.isSource = function(planet)
	{
		for (var i = 0; i < this.sources.length; i++)
		{
			if (this.sources[i].pid == planet.id) return true;
		}
		return false;
	};
	expanderAPS.prototype.setPotentialTurnTargets = function(aps)
    {
        aps.turnTargets = autopilot.frnnOwnPlanets;
        if (aps.destination.ownerid != vgap.player.id)
        {
            aps.turnTargets.push({ pid: aps.destination.id, x: aps.destination.x, y: aps.destination.y });
        }
    };
	expanderAPS.prototype.setPotentialDestinations = function(aps)
	{
		if (aps.destination) return;
		console.log("Determine potential destinations...");
		//
		if (this.sinks.length < 1) this.setSinks(aps);
		//
		if (this.sources.length < 1) this.setSources(aps);
		//
		if (aps.planet && (this.isSource(aps.planet) || aps.ship.clans > 0)) // toDo: function that returns if we have a "colonization kit" on board (clans and suplies (and MCs))
		{
			// if we are at source, set sinks as potential destinations
			console.log("...for expander at source:");
			aps.potDest = this.sinks;
			// sort by value... high to low
			// aps.potDest = aps.sortCollection(aps.potDest, "value", "desc");
		} else
		{
			// set sources as potential destinations, if we are at a sink
			console.log("...for expander at an unowned planet:");
			aps.potDest = this.sources;
		}
		if (aps.potDest.length === 0)
		{
			console.warn("No destinations available!");
		} else
		{
			console.log(aps.potDest);
		}
	};
    expanderAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        // aps.potDest = aps.potDest;
    };
	expanderAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			if (aps.isOwnPlanet && this.isSource(aps.planet)) // we are at a source
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
		if (this.ooiPriority == "cla") // fixed
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
        if (inRange.length > 2 || this.ooiPriority == "cla")
        {
            aps.scopeRange *= 2;
        } else if (inRange.length > 5)
        {
            aps.scopeRange *= 3;
        }
    };
	collectorAPS.prototype.getGoodToGoSources = function(aps, sources)
    {
        var goodToGo = [];
        for (var i = 0; i < sources.length; i++)
        {
            // check if enough resources are there
            var tPlanet = vgap.planetAt(sources[i].x, sources[i].y);
            var futRes = aps.getFutureSurfaceResources(tPlanet, aps.getETA(tPlanet));
            //console.log("... potential target's " + tPlanet.id + " future resources ");
            //console.log(futRes);
            //
            var tValue = 0;
            if (this.ooiPriority == "all")
            {
                tValue = futRes.buildRes;
            } else
            {
                tValue = futRes[aps.moveables[this.ooiPriority]];
            }
            //console.log("... [i] minimum amount of " + this.ooiPriority + ": " + this.devideThresh + " (" + tValue + " available) ");
            if (tValue < this.devideThresh)
            {
                console.log("...removing destinations: " + tPlanet.id + " due to lack of resources (" + tValue + " / " + this.devideThresh + ")!");
                continue;
            }
            goodToGo.push(sources[i]);
        }
        return goodToGo;
    };
	collectorAPS.prototype.setSources = function(aps)
	{
		this.setScopeRange(aps);
        var k = 1;
        var targetsInRange = [];
        while(targetsInRange.length < 1)
        {
            k++;
            if (k * aps.simpleRange > aps.scopeRange) break; // toDo: this way scope range is ineffective...
            targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.simpleRange * k);
            if (targetsInRange.length > 0 && this.ooiPriority != "mcs")
            {
                targetsInRange = this.getGoodToGoSources(aps, targetsInRange);
            }
        }
        console.log("... potential targets: " + targetsInRange.length);
        var potential = [];
		for (var i = 0; i < targetsInRange.length; i++)
		{
			var tPlanet = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
            var tValue = aps.getObjectExcess(tPlanet);
			var distance = Math.floor(aps.getDistance( {x: tPlanet.x, y: tPlanet.y}, {x:aps.ship.x ,y:aps.ship.y} ));
			var eta = aps.getETA(tPlanet);
            potential.push( { x: tPlanet.x, y: tPlanet.y, pid: tPlanet.id, value: tValue, distance: distance, eta: eta } );
		}
		this.sources = aps.clusterSortCollection(potential, "eta", "value");
        //this.sources = aps.sortCollection(potential, "distance");
	};
    collectorAPS.prototype.setPotentialTurnTargets = function(aps)
    {
        aps.turnTargets = autopilot.frnnOwnPlanets;
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
            var pp = aps.potDest[i];
            // if potential destination is not our base but the base of another APS
            if (pp.pid != aps.base.id && aps.isAPSbase(pp.pid))
            {
                var starbase = vgap.getStarbase(pp.pid);
                if (starbase && this.ooiPriority != "cla")
                {
                    console.log("...removing destination " + pp.pid + " as we do not collect from other bases with starbase");
                    continue;
                }
                // the base is employing APS of the same type (collector with priority x)
                if (aps.baseHasSameAPStype(pp.pid, "col", this.ooiPriority))
                {
                    console.log("...removing destination " + pp.pid + " due to collector mission conflict");
                    continue;
                }
            }
            filteredDest.push(pp);
        }
        aps.potDest = filteredDest;
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
				baseSequence = [ { res: "mol", value: parseInt(aps.planet.molybdenum) }, { res: "tri", value: parseInt(aps.planet.tritanium) } ];
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
			baseSequence = aps.sortCollection(baseSequence, "value");
			baseSequence.forEach(function(seq){ loadingSequence.push(aps.moveables[seq.res]); });
			//console.log(loadingSequence);
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
	distributorAPS.prototype.setSinks = function(aps)
	{
	    var splitBy = "deficiency";
		if (this.ooiPriority == "cla")
		{
			this.sinks = autopilot.clanDeficiencies;
			splitBy = "government";
			this.devideThresh = 5;
		} else if (this.ooiPriority == "neu")
		{
			this.sinks = autopilot.neuDeficiencies;
		} else if (this.ooiPriority == "sup")
		{
			this.sinks = autopilot.supDeficiencies;
            splitBy = "resources";
			this.devideThresh = 4000; // toDo: average of all planets?
		} else if (this.ooiPriority == "mcs")
        {
            this.sinks = autopilot.mcDeficiencies;
            splitBy = "resources";
            this.devideThresh = 4000; // toDo: average of all planets?
        }
        var trueSinks = [];
		for (var i = 0; i < this.sinks.length; i++)
		{
			if (aps.getMissionConflict(this.sinks[i].pid)) continue;
			var sinkPlanet = vgap.getPlanet(this.sinks[i].pid);
			this.frnnSinks.push({x: sinkPlanet.x, y: sinkPlanet.y});
			var distance = Math.floor(aps.getDistance({x: sinkPlanet.x, y: sinkPlanet.y}, {x:aps.ship.x ,y:aps.ship.y}));
			// update deficiencies (...unloading could have ocurred)
			var def = this.getObjectDeficiency(sinkPlanet);
			if (def > -10)
			{
			    continue;
            } else
            {
                this.sinks[i].deficiency = def;
                this.sinks[i].distance = distance;
                this.sinks[i].x = sinkPlanet.x;
                this.sinks[i].y = sinkPlanet.y;
                trueSinks.push(this.sinks[i]);
            }
		}
		// priorities by degree of deficiency (split)... and sort splits by distance
		this.sinks = aps.getDevidedCollection(trueSinks, splitBy, this.devideThresh, "distance");
		console.log(this.sinks);
	};
	distributorAPS.prototype.getObjectDeficiency = function(object)
    {
        if (this.ooiPriority == "cla")
        {
            return autopilot.getClanDeficiency(object);
        } else if (this.ooiPriority == "neu")
        {
            return autopilot.getFuelDeficiency(object);
        } else if (this.ooiPriority == "sup")
        {
            return autopilot.getSupDeficiency(object);
        } else if (this.ooiPriority == "mcs")
        {
            return autopilot.getMcDeficiency(object);
        }
        return false;
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
		} else if (this.ooiPriority == "sup")
		{
			this.sources = autopilot.supSources;
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
    distributorAPS.prototype.setPotentialTurnTargets = function(aps)
    {
        aps.turnTargets = autopilot.frnnOwnPlanets;
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
    distributorAPS.prototype.evaluateMissionDestinations = function(aps)
    {
        var potDestAreSources = false;
        var filteredDest = [];
        console.log("...filtering distributor destinations: " + aps.potDest.length);
        if (this.isSource(aps.potDest[0].pid)) potDestAreSources = true;
        for (var i = 0; i < aps.potDest.length; i++)
        {
            // if potDest are sources, remove bases of other APS
            if (potDestAreSources && aps.isAPSbase(aps.potDest[i].pid)) continue;
            filteredDest.push(aps.potDest[i]);
            // if potDest are sinks, we do not filter at this point
        }
        aps.potDest = filteredDest;
    };
	distributorAPS.prototype.handleCargo = function (aps)
	{
		if (aps.planet)
		{
			var transCargo = 0;
            aps.unloadCargo(); // unload cargo
			if (this.isSource(aps.planet))
			{
				transCargo = this.loadCargo(aps); // load cargo
			} else if (this.isSink(aps.planet))
			{
				if (this.ooiPriority == "neu") aps.unloadFuel();
			}
			console.log("Cargo summary: " + transCargo);
		}
	};
	distributorAPS.prototype.loadCargo = function(aps)
	{
		var transCargo = 0;
		var dP = vgap.getPlanet(aps.destination.id);
		var factor = 1.1;
		if (this.ooiPriority == "neu") factor = 2;
		var deficiency = Math.floor((this.getObjectDeficiency(dP) * -1) * factor); // bring more...
		if (deficiency > 0)
		{
			var object = aps.moveables[this.ooiPriority];
			var available = autopilot.getSumAvailableObjects(aps.planet, object);
            console.log("There is " + available + " " + object + " available");
			if (available < 0) available = 0;
			if (deficiency > available)
            {
                deficiency = available;
            }
			transCargo = aps.loadObject(object, aps.planet, deficiency);
		}
		console.log("Loaded (" + this.ooiPriority + "): " + transCargo + "/" + deficiency);
		return (transCargo - deficiency);
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
        this.newFunction = data.newFunction;
        this.newOoiPriority = data.ooiPriority;
        this.idle = data.idle;

        // set defaults (not already set in data)
        if (typeof this.destination == "undefined") this.destination = false;
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
            newFunction: this.newFunction,
            newOoiPriority: this.newOoiPriority,
            idle: this.idle
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
        this.enemySafetyZone = 81;
		this.scopeRange = 162;

		this.simpleRange = 81; // warp 9 max turn distance
		this.maxRange = 160; // adjusted by maxRange
		this.defaultFixedRadius = 160; // adjusted by maxRange (=50 %)

		this.planet = false; // current planet (if at any)
        this.isOwnPlanet = false;
		this.base = false; // base -> planet object
        this.atBase = false; // bool
        this.inWarpWell = false; // bool
        this.destination = false; // destination -> planet object
        this.atDestination = false; // bool
		//
        this.storedData = false; // stored data of APS
        this.apcBaseIds = [];
        this.apcDestinations = [];
        this.apcByBase = {};
        this.apcByShip = {};
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
		this.noteColor = "ff9900";
		this.turnTargets = []; // potential next targets
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
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority
                });
                if (typeof this.apcByShip[apsData[i].sid] == "undefined") this.apcByShip[apsData[i].sid] = [];
                this.apcByShip[apsData[i].sid].push({
                    base: apsData[i].base,
                    destination: apsData[i].destination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority
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
		if (this.hull.special && this.hull.special.match(/^Gravitonic/)) this.gravitonic = true;
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
				this.storedData = autopilot.syncLocalStorage(storageData);
				this.hasToSetPotDes = true;
                console.log("APS scheduled for potential destination determination.");
			} else
			{
				// planet is not the destination
				console.log("We are at pitstop, set next target...");
				this.setShipTarget(this.destination);
			}
		} else
		{
			if (this.planet)
			{
				console.log("...at planet with no destination set.");
				this.hasToSetPotDes = true;
			} else
			{
                if (storageData.destination)
                {
                    this.destination = vgap.getPlanet(storageData.destination);
                    console.log("...in space / warp well with destination (" + storageData.destination + ") set.");
                    this.setShipTarget(this.destination);
                } else
                {
                    console.log("...in space / warp well with no destination set.");
                    this.hasToSetPotDes = true;
                }
			}
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
	APS.prototype.getETA = function( dest, origin )
	{
		if (typeof origin == "undefined") origin = { x: this.ship.x, y: this.ship.y };
        if (typeof dest == "undefined") dest = { x: this.ship.targetx, y: this.ship.targety };
		var ETA = 1;
		var maxTurnDist = Math.pow(this.ship.warp,2);
		var journeyDist = Math.floor(this.getDistance({ x: origin.x, y: origin.y }, { x: dest.x, y: dest.y }));
		if (journeyDist > maxTurnDist) ETA = Math.ceil(journeyDist / maxTurnDist);
		return ETA;
	};
	/*
	 *  positional information
	 */
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
			var curDistToMinefieldCenter = Math.floor(this.getDistance({x: mf[i].x, y: mf[i].y}, {x: object.x, y: object.y}));
			if (strict) // only true if we are INSIDE minefield
			{
				if (mf[i].radius > curDistToMinefieldCenter)
                {
                    if (friendly) console.log("Object (" + object.name + ") inside friendly minefield.");
                    return true;
                }
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
        if (typeof strict == "undefined") strict = true;
        var ionStorms = vgap.ionstorms;
        for (var i = 0; i < ionStorms.length; i++)
        {
            var curDistToIonStormCenter = Math.floor(this.getDistance({x: ionStorms[i].x, y: ionStorms[i].y}, {x: object.x, y: object.y}));
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
        if (typeof coords == "undefined") coords = {x: this.ship.x,y: this.ship.y};
        var planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        var closestPlanets = this.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 3);
        if (closestPlanets.length < 1) return false; // if there are no planets within 3 lj, we are not in warp well
        // <= 3 lj distance between planet and ship -> within warp well
        return true;
    };
    APS.prototype.isAPSbase = function(pid)
    {
        if (this.apcBaseIds.indexOf(pid) > -1) return true;
        return false;
    };
    APS.prototype.baseHasSameAPStype = function(pid, sf, ooi)
    {
        for (var i = 0; i < this.apcByBase[pid].length; i++)
        {
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
    APS.prototype.curTargetIsNotOurs = function()
    {
        var tP = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (tP) return (tP.ownerid != vgap.player.id);
        return true;
    };
    //
	APS.prototype.isDangerousIonStorm = function(iStorm)
	{
		if (this.getIonStormClass(iStorm) == "dangerous" || this.getIonStormClass(iStorm) == "very dangerous") return true;
		return false;
	}
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
	APS.prototype.clusterSortCollection = function(collection, cluster, order)
    {
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
                    //console.log("Add collection to cluster...");
                    clusterCollection.push(collection[k]);
                }
            }
            if (clusterCollection.length > 0)
            {
                if (newCollection.length > 0)
                {
                    newCollection.concat(this.sortCollection(clusterCollection, order, "desc"));
                } else
                {
                    newCollection = this.sortCollection(clusterCollection, order, "desc");
                }
            }
        }
        //console.log("clustered Collection:");
        //console.log(newCollection);
        return newCollection;
    };
	APS.prototype.getOptimalFuelConsumptionEstimate = function(cargo, distance)
	{
		var hullCargoMass = this.getHullCargoMass(cargo);
		var maxTurnDist = Math.pow(this.ship.warp,2);
        var jDist = 0;
        if (typeof distance == "undefined")
        {
            jDist = Math.floor(this.getDistance({x: this.ship.x, y: this.ship.y}, {x: this.ship.targetx, y: this.ship.targety}));
        } else
        {
            jDist = distance;
        }
		var penalty = 0; // cloaking or some other additional fuel requironment
		var basicConsumption = vgap.turnFuel(jDist, hullCargoMass, this.fFactor, maxTurnDist, penalty);
		//
		var actualConsumption = vgap.turnFuel(jDist, hullCargoMass + basicConsumption, this.fFactor, maxTurnDist, penalty);
		while (actualConsumption > basicConsumption)
		{
			basicConsumption += 1;
			if (basicConsumption > this.hull.fueltank) return false; // required fuel exceeds tank capacity
			actualConsumption = vgap.turnFuel(jDist, hullCargoMass + basicConsumption, this.fFactor, maxTurnDist, penalty);
		}
		actualConsumption++;
		return actualConsumption;
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
	/*
	 *  mission specifics
	 */
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
            if (this.planet && potPlanet.id == this.planet.id) continue; // toDo: current planet can't be a mission destination ?
            if (potPlanet.id == this.base.id && this.isSavePosition(potPlanet)) // our base, if save, is always a valid target
            {
                filteredDest.push(this.potDest[i]);
            } else
            {
                if (potPlanet.note && potPlanet.note.body.match(/nup:base/)) // don't use (other) prospected starbase planets
                {
                    console.log("...removing destinations: " + potPlanet.id + " - a starbase will be built here!");
                    continue;
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
		}
		console.log("Remaining destinations: " + filteredDest.length);
		if (avoidDest.length > 0)
		{
			console.log("Adding avoid-destinations: " + avoidDest.length);
			filteredDest.concat(avoidDest);
		}
		this.potDest = filteredDest;
	};
    APS.prototype.setMissionDestination = function()
    {
        var dP = false;
        if (this.potDest.length > 0) {
            this.evaluateMissionDestinations();
            console.warn("Setting destination of APS...");
            console.log(this.potDest);
            if (this.potDest.length > 0) {
                dP = vgap.planetAt(this.potDest[0].x, this.potDest[0].y);
                this.destination = dP;
                this.updateStoredData();
            } else
            {
                return; // idle
            }
        } else
        {
            if (this.shipFunction == "alc")
            {
                this.functionModule.updateFC(this);
                console.log("APS alchemy cargo handling...");
            } else
            {
                dP = vgap.getPlanet(this.destination.id);
                console.log("APS on route to destination...");
            }
        }
        if (this.planet && this.isOwnPlanet) this.functionModule.handleCargo(this); // load specific amount...
        if (dP && (this.planet || this.isInWarpWell()))
        {
            this.setShipTarget(dP);
            this.setWarp();
        }
    };
	APS.prototype.confirmMission = function()
	{
		// this.functionModule.confirmMission(this);
        var curTarget = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (curTarget && !this.isSavePosition(curTarget))
        {
            // fall-back to base...
            console.warn("Emergency: Enemy in range - flight mode -> returning back to base!");
            this.setShipTarget(this.base);
        }
        if (this.destination)
        {
            if (this.checkFuel()) {
                console.log("Checkfuel ok...");
                this.isIdle = false;
                this.updateStoredData();
            } else {
                console.warn("Checkfuel not ok...(idle)");
                if (this.planet && !this.isSavePosition(this.planet))
                {
                    this.escapeToWarpWell();
                } else
                {
                    this.isIdle = true;
                    this.updateStoredData();
                }
            }
        } else
        {
            console.warn("No destination found...(idle)");
            if (this.planet && !this.isSavePosition(this.planet))
            {
                this.escapeToWarpWell();
            } else
            {
                this.isIdle = true;
                this.updateStoredData();
            }
        }
	};
	APS.prototype.getMissionConflict = function(potPlanet)
	{
	    // todo: module specific handling
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
				var curShip = vgap.getShip(storedGameData[i].sid);
				if (curShip)
				{
					// current location of storage APS
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
                // if potential destination already is mission destination of an APS...
				if (potPlanet.id != this.base.id && storedGameData[i].destination == potPlanet.id)
				{
				    // if shipFunction and ooiPriority are the same...
					if (storedGameData[i].shipFunction == this.primaryFunction && storedGameData[i].ooiPriority == this.objectOfInterest)
					{
                        console.log("...planet " + potPlanet.id + " is mission destination of another APS with the same mission objective!");
                        // toDo: reconsider
                        //   - if the planet has more resourcen than one APS can carry
                        //   - if another APS will drop something off... etc.
                        //   -
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
			if (this.destination)
			{
			    if (this.destination.id == this.base.id)
                {
                    destination = ">home";
                } else
                {
                    destination = ">"+this.destination.id;
                }
			}
			note.body = "B|" + this.base.id + " | " + this.primaryFunction + " | " + this.objectOfInterest + " " + destination;
			note.color = this.noteColor;
		} else
		{
			note.body = " ";
            note.color = "000000";
		}
	};
	/*
	 *  target selection specifics
	 */
	APS.prototype.getETAbyTargets = function()
    {
        var targetIds = [];
        var adjustment = 0;
        var ETA = 0;
        var ship = { x: this.ship.x, y: this.ship.y };
        while(targetIds.indexOf(this.destination.id) === -1)
        {
            var curTargets = [];
            while(curTargets.length < 1)
            {
                curTargets = this.getTurnTargets(ship, this.destination, adjustment);
                adjustment += 10;
                if (adjustment > 300) break;
            }
            if (curTargets.length > 0)
            {
                // push first ID to array
                targetIds.push(curTargets[0].pid);
                ETA += curTargets[0].eta;
                ship = { x: curTargets[0].x, y: curTargets[0].y };
            }
        }
        console.log("The ship (" + this.ship.id + ") needs " + ETA + " turns, to arrive at destination when using turnTargets...");
        return ETA;
    };
	APS.prototype.targetHasEnoughFuel = function(tP)
    {
        var dP = this.destination;
        if (tP.id == dP.id) return true;
        var targetDestinationDist = Math.floor(this.getDistance( {x: tP.x , y: tP.y}, {x: dP.x , y: dP.y} ));
        var nextFuelCons = this.getOptimalFuelConsumptionEstimate([], targetDestinationDist);
        var travelDistance = Math.floor(this.getDistance( {x: this.ship.x, y: this.ship.y}, {x: tP.x, y: tP.y} ));
        var thisFuelCons = this.getOptimalFuelConsumptionEstimate([], travelDistance);
        var remainingFuel = this.ship.neutronium - thisFuelCons;
        var futRes = {neutronium: 0};
        if (tP.ownerid == vgap.player.id)
        {
            futRes = this.getFutureSurfaceResources(tP, this.getETA(tP));
        }
        console.log("...targetHasEnoughFuel: (" + tP.id + ") " + (nextFuelCons <= (futRes.neutronium + remainingFuel)));
        return (nextFuelCons <= (futRes.neutronium + remainingFuel));
    };
    /*
     * set next stop to destination x, y
     */
    APS.prototype.setShipTarget = function(dP)
    {
        var turnTargets = [];
        console.log("Searching target on the way to " + dP.name + " (" + dP.id + ")...");
        var ttETA = this.getETAbyTargets(); // toDo: not accurate yet...
        var dirETA = this.getETA(dP);
        if ((dirETA < ttETA && this.functionModule.cruiseMode == "fast") || this.functionModule.cruiseMode == "direct")
        {
            console.log("A direct approach of destination is faster (" + dirETA + "/" + ttETA+ ")!");
            if (this.isSavePosition(dP))
            {
                turnTargets.push( { x: dP.x, y: dP.y } );
            }
        } else
        {
            var adjustment = 0;
            turnTargets = this.getTurnTargets(this.ship, dP, adjustment);
            //
            while (turnTargets.length === 0)
            {
                adjustment += 10;
                if (adjustment > 300) break;
                turnTargets = this.getTurnTargets(this.ship, dP, adjustment);
            }
        }
        console.log("Turntargets:");
        console.log(turnTargets);
        if (turnTargets.length > 0)
        {
            this.ship.targetx = turnTargets[0].x;
            this.ship.targety = turnTargets[0].y;
        } else {
            this.escapeToWarpWell();
        }
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
            pileA = this.sortCollection(pileA, order, direction);
            pileB = this.sortCollection(pileB, order, direction);
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
		pileA = this.sortCollection(pileA, order, direction);
		pileB = this.sortCollection(pileB, order, direction);
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
		return frnn.inRange( { x: x, y: y }, r);
	};
	APS.prototype.getTurnTargets = function(ship, dP, adjustment)
	{
	    this.functionModule.setPotentialTurnTargets(this);
	    // TurnTargets: {x, y, distance(toDestination), planetId}
        // var frnnTargets = autopilot.frnnOwnPlanets;
		var frnnTargets = this.turnTargets;
		var closerTurnTargets = [];
		var turnTargets = this.getTargetsInRange(frnnTargets, ship.x, ship.y, (this.simpleRange + adjustment));
		for (var i = 0; i < turnTargets.length; i++)
		{
			var tt = turnTargets[i];
            var tP = vgap.planetAt(tt.x, tt.y);
            // distance from current location to destination planet
            var curPosDistance = Math.floor(this.getDistance( {x: ship.x, y: ship.y}, {x: dP.x, y: dP.y} ));
			// distance between potential next stop and the destination (in case the potential next stop is the destination, distance is 0)
            var nextPosDistance = Math.floor(this.getDistance( {x: tt.x , y: tt.y}, {x: dP.x , y: dP.y} ));
            // toDo: exclude targets where minefields or other dangers had to be crossed/passed
            if (nextPosDistance < curPosDistance && this.targetHasEnoughFuel(tP) && this.isSavePosition(tP))
            {
                turnTargets[i].distance = nextPosDistance;
                turnTargets[i].eta = this.getETA(tt, ship);
                //var futRes = this.getFutureSurfaceResources(tP, turns);
                //turnTargets[i].fuel = futRes.neutronium;
                turnTargets[i].pid = tP.id;
                closerTurnTargets.push(turnTargets[i]);
            }
		}
		// sort the targets by distance
        closerTurnTargets.sort(function(a, b) {
				var x = a.distance;
				var y = b.distance;
				if (x < y) {return -1;}
				if (x > y) {return 1;}
				return 0;
			});
		return closerTurnTargets;
	};
    APS.prototype.isSavePosition = function(planet)
    {
        // toDo: planets in radiation zones, if you don't have special shielding
        //
        var ionStorm = this.objectInsideIonStorm(planet); // strict
        if (ionStorm)
        {
            if (Math.floor(ionStorm.voltage * 1.2) > 150)
            {
                console.log("...planet (" + planet.id + ") is inside ~dangerous ion storm!");
                return false;
            }
        }
        if (this.objectInsideMineField(planet, true, true)) return true; //  position is protected by minefield
        if (this.objectInsideMineField(planet, false, true)) // don't visit planets in enemy minefields
        {
            console.log("...planet (" + planet.id + ") is inside minefield!");
            return false;
        }
        if (this.objectInRangeOfEnemy(planet))
        {
            console.log("...planet (" + planet.id + ") is close to enemy!");
            return false;
        }
        return true;
    };
    APS.prototype.getObjectsInRangeOf = function(objects, range, of)
    {
        var objectsInRange = [];
        for (var j = 0; j < objects.length; j++)
        {
            var dist = Math.floor(this.getDistance({x: objects[j].x, y: objects[j].y}, {x: of.x, y: of.y}));
            if (dist <= range)
            {
                objectsInRange.push(objects[j]);
                //console.log("...");
            }
        }
        return objectsInRange;
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
                if (cH.mass > 200 && ships[i].beams > 0 && (ships[i].torps > 0 || ships[i].bays > 0) && ships[i].ammo > 0)
                {
                    console.log("...ship " + ships[i].id + " is guarding the planet.");
                    return true;
                }
                //console.log(ships[i]);
            }
        }
        return false;
    };
    APS.prototype.objectInRangeOfEnemy = function(object)
    {
        if (typeof object == "undefined") return true;
        if (this.objectGuarded(object)) return false; // exclude guarded planets from this check
        // objects = enemy planets, in range of... object
        var eP = this.getObjectsInRangeOf(autopilot.frnnEnemyPlanets, this.enemySafetyZone, object);
        // objects = enemy ships, in range of... object
        var eS = this.getObjectsInRangeOf(autopilot.frnnEnemyShips, this.enemySafetyZone, object);
        // avoid planets in close proximity of enemy planets
        if (eP.length > 0) return true;
        //
        for (var j = 0; j < eS.length; j++)
        {
            // only when ship has weapons toDo: or when ship is capable of robbing?
            if (eS[j].armed)
            {
                console.log("...position (" + object.id + ":" + object.x + "x" + object.y + ") is in range (" + this.enemySafetyZone + " lj) of enemy ship - (" + eS[j].x + "x" + eS[j].y + ")!");
                return true;
            }
        }
        return false;
    };
	// interaction specifics
	APS.prototype.checkFuel = function()
	{
        this.setWarp(); // set warp factor according to current circumstances
        var fuel = Math.floor(this.getFuelConsumptionEstimate() * 1.5); // use more to be more flexible
        if (fuel <= parseInt(this.ship.neutronium)) return true; // if there is enough, we don't need to load fuel
        var loadedFuel = this.ship.neutronium; // amount we have on board
        var backFuel = 0;
        // provide basic fuel backup for (empty) return trip from unowned planet..
        if (this.curTargetIsNotOurs())
        {
            var distance = this.getDistance( { x: this.ship.x, y: this.ship.y }, { x: this.ship.targetx, y: this.ship.targety } );
            backFuel = Math.floor(this.getOptimalFuelConsumptionEstimate([], distance) * 1.1);
        }
        fuel += backFuel;
		if (this.planet && this.isOwnPlanet) // only load if we are in orbit around one of our planets
		{
            loadedFuel = this.loadObject("neutronium", this.planet, fuel); // returns amount on board after loading
        }
        console.log("We have " + loadedFuel + " neutronium aboard and need " + fuel);
        if (loadedFuel >= fuel)
        {
            return true;
        } else
        {
            // there is not enough fuel!
            if (this.planet)
            {
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
                    console.log("Waiting for fuel (" + shortage + ") to become available...");
                    this.setWarp(0);
                    return false; // consider other options
                }
            } else {
                if (this.isInWarpWell())
                {
                    console.log("Waiting for fuel (" + shortage + ") to become available...");
                    this.setWarp(0);
                    return false; // consider other options
                }
            }
        }
	};
	APS.prototype.unloadFuel = function()
	{
		if (this.planet && this.isOwnPlanet)
		{
			var amount = parseInt(this.ship.neutronium) - 1;
			var onShip = this.unloadObject("neutronium", this.planet, amount);
		}
	};
	APS.prototype.unloadCargo = function()
	{
        if (this.primaryFunction == "exp")
        {
            this.functionModule.transferCargo(this);
        } else if (this.planet && this.isOwnPlanet)
		{
            var unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
            for (var i = 0; i < unloadingSequence.length; i++)
            {
                var cargo = unloadingSequence[i];
                var onShip = this.unloadObject(cargo, this.planet, parseInt(this.ship[cargo]));
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
	APS.prototype.escapeToWarpWell = function()
    {
        if (this.isInWarpWell())
        {
            console.log("We are in warp well...");
            // toDo: do we have to move? are there enemy ships close by?
        } else {
            console.log("Moving into warp well...");
            var coords = this.getRandomWarpWellEntryPosition();
            this.ship.targetx = coords.x;
            this.ship.targety = coords.y;
            this.setWarp(1);
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
    APS.prototype.getObjectExcess = function(object)
    {
        var tValue = 0;
        if (this.functionModule.ooiPriority == "all")
        {
            // amount of all resources that are used to build ships
            tValue = parseInt(object.duranium) + parseInt(object.tritanium) + parseInt(object.molybdenum);
        } else if (this.functionModule.ooiPriority == "cla")
        {
            // amount of free clans
            tValue = autopilot.getFreeClans(object);
        } else if (this.functionModule.ooiPriority == "mcs")
        {
            // amount of theoretical cash (megacredits and supplies)
            tValue = parseInt(object.megacredits) + parseInt(object.supplies);
            // if we don't want to sell supplies on bovinoid planets we only count megacredits
            if (object.nativeracename == "Bovinoid" && this.functionModule.sellSupply == "notBov") tValue = object.megacredits;
        } else
        {
            tValue = parseInt(object[this.moveables[this.functionModule.ooiPriority]]);
        }
        return tValue;
    };
	// Ship specifics
    APS.prototype.getHullCargoMass = function(scargo)
    {
        var hullCargoMass = this.hull.mass;
        var maxHullCargoMass = this.hull.mass + this.hull.cargo;
        if (typeof scargo !== "undefined" && scargo.length > 0)
        {
            scargo.forEach(function(comp) { hullCargoMass += parseInt(comp); });
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
    APS.prototype.getFuelConsumptionEstimate = function(cargo, distance)
    {
        // estimation how much fuel we would need
        // if cargo is set, use those numbers, if not, use the actual cargo
        var optimalConsumption = this.getOptimalFuelConsumptionEstimate(cargo, distance);
        if (this.functionModule.energyMode == "max") return this.hull.fueltank; // does not need estimate, we will use complete fuel capacity
        if (this.functionModule.energyMode == "moderate") return Math.floor(optimalConsumption * 1.2); // we will use 120 % of optimal consumption
        if (optimalConsumption < 1) {
            return 1;
        } else
        {
            return optimalConsumption;
        }
    };
    APS.prototype.shipHasWeapons = function(ship)
    {
        var shipHull = vgap.getHull(ship.hullid);
        // toDo: the ability to rob the ship, is a weapon. So any privateer ship returns true...
        return (shipHull.beams > 0 || shipHull.fighterbays > 0 || shipHull.launchers > 0);
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
        if (warp > 0 && warp < 10) this.ship.warp = warp;
        // reduce speed to warp 4, if we are currently inside a minefield
        if (this.objectInsideMineField( {x: this.ship.x, y: this.ship.y}, false, true ) && this.ship.engineid > 4) this.ship.warp = 4;
        // set warp 1 if we are moving into or inside warp well
        if (this.isInWarpWell({x: this.ship.targetx, y: this.ship.targety})) this.ship.warp = 1;
        // update fuelFactor
        this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp];
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
        isChromeBrowser: false,
        realTurn: false,
        gameId: false,
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
				// toDo: consider heading
				if (ship.ownerid != vgap.player.id && !autopilot.isAlly(ship.ownerid))
				{
				    var isArmed = false;
                    var shipHull = vgap.getHull(ship.hullid);
                    console.log("Checking if ship ( " + ship.id + " ) has weapons...");
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
				if (planet.ownerid > 0 && planet.ownerid != vgap.player.id && !autopilot.isAlly(planet.ownerid))
				{
					autopilot.frnnEnemyPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
				}
				// toDo: ownerid === 0 = unowned? or also unknown owner?
				if (planet.ownerid == 0) autopilot.frnnUnownedPlanets.push({pid: planet.id, x: planet.x, y: planet.y});
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
        scanReports: function()
        {
            // check messages for combat reports where APS might have been destroyed...
            // this is necessary due to the recycling of shipIDs
            vgap.messages.forEach(function (msg) {
                if (msg.template == "shipdestroyed")
                {
                    if (msg.ownerid == vgap.player.id)
                    {
                        // if target is a APS, delete local storage entry
                        var apsData = autopilot.isInStorage(msg.target);
                        if (apsData)
                        {
                            apsData.ooiPriority = "END";
                            autopilot.syncLocalStorage(apsData);
                        }
                    }
                }
            });
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
				//console.log("Planet " + planet.id + " free clans: " + natFreeClans);
				return natFreeClans;
			} else
			{
				//console.log("Planet " + planet.id + " free clans: " + freeClans);
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
        getSupDeficiency: function(planet)
        {
            var deficiency = 0;
            var tfdef = parseInt(planet.targetfactories) - parseInt(planet.factories);
            var tmdef = parseInt(planet.targetmines) - parseInt(planet.mines);
            var tddef = parseInt(planet.targetdefense) - parseInt(planet.defense);
            if (tfdef > 0) deficiency += tfdef;
            if (tmdef > 0) deficiency += tmdef;
            if (tddef > 0) deficiency += tddef;
            deficiency = parseInt(planet.supplies) - deficiency;
            return deficiency;
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
        getSumOfAllMinerals: function(planet)
        {
            var p = planet;
            return parseInt(p.tritanium+p.groundtritanium+p.molybdenum+p.groundmolybdenum);
            //return (p.neutronium+p.groundneutronium+p.tritanium+p.groundtritanium+p.molybdenum+p.groundmolybdenum);
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
                if (planet.ownerid == vgap.player.id)
                {
                    // clan sinks (-) and sources (+)
                    var def = autopilot.getClanDeficiency(planet);
                    if (def >= 0)
                    {
                        def = autopilot.getFreeClans(planet);
                        if (def > 50 && planet.nativeracename != "Amorphous") autopilot.clanSources.push({ pid: planet.id, value: def });
                    } else
                    {
                        autopilot.clanDeficiencies.push({ pid: planet.id, deficiency: def, government: planet.nativegovernment });
                    }
                    // neutronium sinks (-) and sources (+)
                    def = autopilot.getFuelDeficiency(planet);
                    if (def >= 0)
                    {
                        if (def > 50) autopilot.neuSources.push({ pid: planet.id, value: def });
                    } else
                    {
                        autopilot.neuDeficiencies.push({ pid: planet.id, deficiency: def });
                    }
                    // supply sinks (-) and sources (+)
                    def = autopilot.getSupDeficiency(planet);
                    if (def >= 0)
                    {
                        if (def > 10) autopilot.supSources.push({ pid: planet.id, value: def });
                    } else
                    {
                        autopilot.supDeficiencies.push({ pid: planet.id, deficiency: def, resources: autopilot.getSumAvailableObjects(planet, "minerals") });
                    }
                    // megacredit sinks (-) and sources (+)
                    def = autopilot.getMcDeficiency(planet);
                    if (def >= 0)
                    {
                        if (def > 500) autopilot.mcSources.push({ pid: planet.id, value: def });
                    } else
                    {
                        autopilot.mcDeficiencies.push({ pid: planet.id, deficiency: def, resources: autopilot.getSumAvailableObjects(planet, "minerals") });
                    }
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
						if (data.ooiPriority == "END")
						{
							storedGameData.splice(i, 1); // delete entry
							autopilot.clearShipTarget(data.sid);
							autopilot.clearShipNote(data.sid);
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
                    autopilot.collectSourceSinkData();
                    autopilot.populateFrnnCollections();
					console.error("Set potential destinations for APS " + aps.ship.id);
					aps.functionModule.setPotentialDestinations(aps);
                    console.error("Set mission destinations for APS " + aps.ship.id);
                    aps.setMissionDestination();
				}
                console.error("Confirm mission for APS " + aps.ship.id);
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
            console.log(vgap);
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
                // toDo: return if an old turn is loaded?
                autopilot.populateFrnnCollections();
                //
                // APS - Initial setup...
                //
                var nCols = ["ff3399", "6666ff", "ffc299", "66b3ff", "ff99ff", "6699ff"];
                var noteColByBase = {}; // color of note text
                var apsControl = [];
                vgap.myships.forEach(function(ship) {
                    var aps = {};
                    var cfgData = autopilot.isInStorage(ship.id);
                    if (cfgData)
                    {
                        // if configuration is available in storage
                        aps = new APS(ship, cfgData);
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
                    if (aps.isAPS)
                    {
                        // add APS to APS-list
                        apsControl.push(aps);
                    }
                });
                //
                // APS that arrived at destination have been unloaded...
                //
                autopilot.collectSourceSinkData();
                //
                // APS without mission destination need to determine potential destinations
                //
                apsControl.forEach(function(shipcontrol) {
                    if (shipcontrol.hasToSetPotDes)
                    {
                        console.error("Set potential destinations for APS " + shipcontrol.ship.id);
                        shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                    }
                });
                //
                // APS with potential mission destinations now evaluate the and pick target(s)
                //
                apsControl.forEach(function(shipcontrol) {
                    if (shipcontrol.potDest.length > 0)
                    {
                        console.error("Set mission destination for APS " + shipcontrol.ship.id);
                        shipcontrol.setMissionDestination();
                    }
                    console.error("Confirm mission of APS " + shipcontrol.ship.id);
                    shipcontrol.confirmMission();
                    shipcontrol.updateNote();
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
                        console.error("Confirm mission of APS " + shipcontrol.ship.id);
                        shipcontrol.confirmMission();
                        shipcontrol.updateNote();
                    }
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
			console.log("LoadShip: plugin called.");
            var apsData = autopilot.isInStorage(vgap.shipScreen.ship.id);
            console.log("Ship idle status: " + apsData.idle);
			if (apsData && apsData.idle)
            {
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
