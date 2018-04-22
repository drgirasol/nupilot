/*
    Copyright 2017, 2018 Thomas Horn
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
// ==UserScript==
// @name          nuPilot
// @description   Planets.nu plugin to enable ship auto-pilots
// @version       0.10.12
// @date          2018-04-21
// @author        drgirasol
// @include       http://planets.nu/*
// @include       http://play.planets.nu/*
// @include       http://test.planets.nu/*
// @resource	  Documentation https://github.com/drgirasol/nupilot/wiki
// @updateURL     https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.js
// @downloadURL   https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.js

// ==/UserScript==

function wrapper () { // wrapper for injection

        /*
     *
     *  Auto Pilot Ship (APS) Object
     *
     */
    function APS(ship, cfgData)
    {
        if (typeof ship === "undefined") return;
        this.ship = ship;
        this.hull = vgap.getHull(ship.hullid);
        this.maxCapacity = false;
        this.curCapacity = false;
        this.minCapacity = false;
        this.demand = [];
        this.isAPS = false;
        this.isIdle = false;
        this.idleReason = [];
        this.idleTurns = 0;
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
        this.terraCooler = false;
        this.terraHeater = false;
        this.enemySafetyZone = 81;
        this.scopeRange = 100; // default scope range for all APS, changed by functionModules
        this.simpleRange = Math.pow(this.ship.engineid, 2); // max warp turn distance
        this.maxRange = 160; // adjusted by maxRange
        this.defaultFixedRadius = 160; // adjusted by maxRange (=50 %)

        this.planet = vgap.planetAt(ship.x, ship.y); // current planet (if at any)
        this.isOwnPlanet = false;
        this.isUnownedPlanet = false;
        this.base = false; // base -> planet object
        this.atBase = false; // bool
        this.inWarpWell = false; // bool
        this.waypoint = false; // holds planet object if target is a planet
        this.destination = false; // destination -> planet object
        this.secondaryDestination = false; // secondary destination -> planet object
        this.lastDestination = false; // previous destination
        this.atDestination = false; // bool
        this.objectOfInterest = false;
        this.currentOoi = false;
        //
        this.storedData = false; // stored data of APS
        this.apcBaseIds = [];
        this.apcDestinations = [];
        this.apcByBase = {};
        this.apcByDest = {};
        this.apcBySecDest = {};
        this.apcByShip = {};
        this.primaryFunction = false;
        this.functionModule = false;
        this.hasToSetPotDes = false;
        this.deficiencies = [ "cla", "neu", "sup", "mcs" ];
        this.minerals = [ "dur", "tri", "mol" ];
        this.oShipMission = false;
        this.shipFunctions = {
            col: "collector",
            dis: "distributor",
            exp: "expander",
            alc: "alchemy",
            hiz: "hizzer",
            ter: "terraformer"
        };
        this.moveables = {
            dur: "duranium",
            tri: "tritanium",
            mol: "molybdenum",
            neu: "neutronium",
            sup: "supplies",
            mcs: "megacredits",
            cla: "clans"
        };
        this.noteColor = "ff9900";
        this.potentialWaypoints = []; // potential next targets
        this.potDest = []; // potential destinations
        //
        if (typeof cfgData !== "undefined" && cfgData !== false)
        {
            this.storedData = cfgData;
            this.isAPS = true;
            this.initializeBoardComputer(cfgData);
        } else
        {
            // not an APS
            this.isAPS = false;
        }
    }
    APS.prototype.bootFunctionModule = function(func)
    {
        if (func === "col")
        {
            console.log("...Collector Mode (" + this.objectOfInterest + ")");
            this.functionModule = new collectorAPS(this);
        } else if (func === "dis")
        {
            console.log("...Distributer Mode (" + this.objectOfInterest + ")");
            this.functionModule = new distributorAPS(this);
        } else if (func === "bld")
        {
            console.log("...Builder Mode (" + this.objectOfInterest + ")");
            this.functionModule = new builderAPS(this);
        } else if (func === "alc")
        {
            console.log("...Alchemy Mode (" + this.objectOfInterest + ")");
            this.functionModule = new alchemyAPS(this);
        } else if (func === "exp")
        {
            console.log("...Expander Mode (" + this.objectOfInterest + ")");
            this.functionModule = new expanderAPS(this);
        } else if (func === "ter")
        {
            console.log("...Terraformer Mode");
            this.functionModule = new terraformerAPS(this);
        } else if (func === "hiz")
        {
            console.log("...Hizzz Mode");
            this.functionModule = new hizzzAPS(this);
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
            if (apsData[i].sid !== this.ship.id)
            {
                this.apcBaseIds.push(apsData[i].base);
                if (apsData[i].destination) this.apcDestinations.push(apsData[i].destination);
                //
                if (typeof this.apcByBase[apsData[i].base] === "undefined") this.apcByBase[apsData[i].base] = [];
                this.apcByBase[apsData[i].base].push({
                    sid: apsData[i].sid,
                    destination: apsData[i].destination,
                    secondaryDestination: apsData[i].secondaryDestination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle,
                    idleReason: apsData[i].idleReason,
                    idleTurns: apsData[i].idleTurns
                });
                if (typeof this.apcByDest[apsData[i].destination] === "undefined") this.apcByDest[apsData[i].destination] = [];
                this.apcByDest[apsData[i].destination].push({
                    sid: apsData[i].sid,
                    base: apsData[i].base,
                    secondaryDestination: apsData[i].secondaryDestination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle,
                    idleReason: apsData[i].idleReason,
                    idleTurns: apsData[i].idleTurns
                });
                if (typeof this.apcBySecDest[apsData[i].secondaryDestination] === "undefined") this.apcBySecDest[apsData[i].secondaryDestination] = [];
                this.apcBySecDest[apsData[i].secondaryDestination].push({
                    sid: apsData[i].sid,
                    base: apsData[i].base,
                    destination: apsData[i].destination,
                    shipFunction: apsData[i].shipFunction,
                    ooiPriority: apsData[i].ooiPriority,
                    idle: apsData[i].idle,
                    idleReason: apsData[i].idleReason,
                    idleTurns: apsData[i].idleTurns
                });
                if (typeof this.apcByShip[apsData[i].sid] === "undefined") this.apcByShip[apsData[i].sid] = [];
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
    APS.prototype.setShipIdleStatus = function(cfg)
    {
        this.isIdle = cfg.isIdle;
        this.idleReason = cfg.idleReason;
        this.idleTurns = cfg.idleTurns;
    };
    APS.prototype.setShipAttributes = function(cfg)
    {
        this.atBase = false; // bool
        this.hasToSetPotDes = false;
        this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp]; // currently applicable fuel factor
        if (this.hull.special && this.hull.special.match(/Gravitonic/)) this.gravitonic = true;
        if (this.hull.special && this.hull.special.match(/Radiation Shielding/)) this.radiationShielding = true;
        if (this.hull.special && this.hull.special.match(/Terraform/) && this.hull.special.match(/lower\splanet\stemperature/)) this.terraCooler = true;
        if (this.hull.special && this.hull.special.match(/Terraform/) && this.hull.special.match(/raise\splanet\stemperature/)) this.terraHeater = true;
        this.inWarpWell = this.isInWarpWell( { x: this.ship.x, y: this.ship.y } );
        if (this.inWarpWell) this.planet = false;
        this.setConventionalShipMission(cfg);
    };
    APS.prototype.setFunctionAttributes = function()
    {
        // toDo: most APS load cargo and MCs, or fuel and MCs... make sure these variables are not used for the wrong cargo
        //
        if (!this.functionModule) this.bootFunctionModule(this.primaryFunction);
        this.maxCapacity = this.hull.cargo;
        this.curCapacity = this.getCargoCapacity();
        this.minCapacity = Math.round(this.functionModule.minimalCargoRatioToGo * this.hull.cargo);
        if (this.objectOfInterest === "neu")
        {
            this.maxCapacity = this.hull.fueltank;
            this.curCapacity = this.getFuelCapacity();
            this.minCapacity = Math.round(this.functionModule.minimalCargoRatioToGo * this.hull.fueltank);
        } else if (this.objectOfInterest === "mcs")
        {
            this.maxCapacity = 10000;
            this.curCapacity = 10000 - this.ship.megacredits;
            this.minCapacity = Math.round(this.functionModule.minimalCargoRatioToGo * 10000);
        } else
        {
            if (this.objectOfInterest === "all" && this.primaryFunction === "dis")
            {
                if (this.currentOoi === "neu")
                {
                    this.maxCapacity = this.hull.fueltank;
                    this.curCapacity = this.getFuelCapacity();
                    this.minCapacity = Math.round(this.functionModule.minimalCargoRatioToGo * this.hull.fueltank);
                } else if (this.currentOoi === "mcs")
                {
                    this.maxCapacity = 10000;
                    this.curCapacity = 10000 - this.ship.megacredits;
                    this.minCapacity = Math.round(this.functionModule.minimalCargoRatioToGo * 10000);
                }
            }
        }
    };
    APS.prototype.setConventionalShipMission = function(cfg)
    {
        this.oShipMission = cfg.oShipMission;
        if (this.oShipMission !== this.ship.mission) this.ship.mission = this.oShipMission; // reset mission to original setting (= when autopilot was activated)
        if (vgap.player.raceid === 2 && this.ship.beams > 0) { this.ship.mission = 8; } // if lizard, set HISS mission
        if (this.hull.cancloak) this.ship.mission = 9; // cloak if possible
    };
    APS.prototype.isMakingTorpedoes = function()
    {
        var s = this.ship;
        return (s.friendlycode.toUpperCase() === "MKT" && s.megacredits > 0 && s.duranium > 0 && s.tritanium > 0 && s.molybdenum > 0);
    };
    APS.prototype.setPositionAttributes = function(cfg)
    {
        this.scopeRange = 200;
        if (!this.inWarpWell) this.planet = vgap.planetAt(this.ship.x, this.ship.y); // note: planetAt returns planet, even if the exact position is in warp well! really?
        this.isOwnPlanet = (this.planet && this.planet.ownerid === vgap.player.id);
        this.isUnownedPlanet = (this.planet && this.planet.ownerid === 0);
        this.base = vgap.getPlanet(cfg.base);
        if (this.planet && this.planet.id === this.base.id) this.atBase = true; // are we at our base of operation
    };
    APS.prototype.setMissionAttributes = function(cfg)
    {
        this.primaryFunction = cfg.shipFunction;
        if (this.primaryFunction === "hiz" && this.planet) autopilot.hizzzerPlanets.push(this.planet.id);
        this.objectOfInterest = cfg.ooiPriority;
        if (this.objectOfInterest === "all" && this.primaryFunction === "dis")
        {
            this.currentOoi = cfg.currentOoi;
        } else
        {
            this.currentOoi = false;
        }
        if (cfg.destination)
        {
            this.destination = vgap.getPlanet(cfg.destination);
        } else
        {
            this.destination = false;
        }
        if (this.destination && !this.isValidDestination(this.destination.id)) this.destination = false; // e.g. is destination (still) our planet
        if (cfg.secondaryDestination) this.secondaryDestination = vgap.getPlanet(cfg.secondaryDestination);
        if (cfg.secondaryDestination === false || (this.secondaryDestination && !this.isValidDestination(this.secondaryDestination.id))) this.secondaryDestination = false; // e.g. is destination (still) our planet
        if (this.destination && this.secondaryDestination && this.destination.id === this.secondaryDestination.id) this.secondaryDestination = false; // toDo: should not happen, but did happen
        if (cfg.lastDestination) this.lastDestination = vgap.getPlanet(cfg.lastDestination);
    };
    APS.prototype.initializeBoardComputer = function(configuration)
    {
        console.error("Initializing flight computer of APC " + this.ship.id);
        this.setMissionAttributes(configuration);
        this.setShipAttributes(configuration);
        this.setRange(); // simple- and max-range AND defaultFixedRadius (1/2 max-range)
        this.setPositionAttributes(configuration);
        //
        // initialize ship function module
        //
        this.bootFunctionModule(configuration.shipFunction);
        this.setFunctionAttributes();
        //
        this.functionModule.devideThresh = this.getDevisionThresh();
        //
        // toDo: remove, only use aps.objectOfInterest (setMissionAttributes)
        // - expander does not use it
        // - builder does not use it
        // - toDo: collector ?
        // - toDo: distributor ?
        // - toDo: terraformer ?
        // - toDo: hizzer ?
        // - toDo: alchemy ?
        //
        this.functionModule.ooiPriority = configuration.ooiPriority;

        this.initAPScontrol(); // get apsBy... collections

        if (this.destination)
        {
            if (this.getMissionConflict(this.destination))
            {
                console.warn("...Mission conflict! Scheduled for potential destination determination.");
                this.hasToSetPotDes = true;
            } else if (this.planet)
            {
                console.log("...at planet with destination (" + this.destination.id + ") set.");
                if (this.secondaryDestination) console.log("...and 2nd destination = " + this.secondaryDestination.id);
                if (this.lastDestination.id === this.planet.id) {
                    console.log("...planet is former destination...");
                }
                console.log("...handle cargo.");
                this.functionModule.handleCargo(this);
                autopilot.refreshColonies();
                // if we are at the destination, clear destination setting
                if (this.planet.id === this.destination.id)
                {
                    console.log("...planet is destination, update configuration.");
                    configuration.lastDestination = this.destination.id;
                    configuration.destination = false;
                    configuration.secondaryDestination = false;
                    configuration.idle = false;
                    configuration.idleReason = [];
                    configuration.idleTurns = 0;
                    // if new behaviour is requested, now is the time for change
                    if (configuration.newFunction !== false)
                    {
                        configuration.shipFunction = configuration.newFunction;
                        configuration.newFunction = false;
                        configuration.ooiPriority = configuration.newOoiPriority;
                        configuration.newOoiPriority = false;
                        this.bootFunctionModule(configuration.shipFunction);
                        this.setFunctionAttributes();
                    }
                    this.setShipIdleStatus(configuration);
                    this.setMissionAttributes(configuration);
                    this.hasToSetPotDes = true; // will determine potDest, select destination and set next target
                    console.log("...scheduled for potential destination determination.");
                } else if (this.secondaryDestination && this.planet.id === this.secondaryDestination.id)
                {
                    console.log("...planet is 2nd destination, update configuration.");
                    configuration.lastDestination = this.secondaryDestination.id;
                    configuration.secondaryDestination = false;
                    this.setMissionAttributes(configuration);
                    console.log("...setting next Target.");
                    this.setShipTarget(this.destination);
                } else
                {
                    console.log("...planet is no destination.");
                    console.log("...setting next Target.");
                    this.setShipTarget(this.destination);
                }
                this.storedData = autopilot.syncLocalStorage(configuration);
            } else
            {
                console.log("...in space / warp-well with destination (" + this.destination.id + ") set.");

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
     * APS.getAPSinRange
     *  By having the information of how many APS are operating within the same area
     *  we can set the scope range of those collectors: the more, the greater the scope range (area with potential destinations)
     *  By having the information of how many APS are operating within the same area
     *  we can filter new potential mission destinations to avoid "clustering" of APS
     */
    APS.prototype.getAPSinRange = function(range)
    {
        var center = {};
        if (this.shipFunction === "col")
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
                if (this.shipFunction === "col" && lStorage[i].shipFunction === this.primaryFunction && lStorage[i].base === this.base)
                {
                    if (lStorage[i].ooiPriority === "all" || this.objectOfInterest === lStorage[i].ooiPriority)
                    {
                        pids.push(lStorage[i].base);
                    }
                } else
                {
                    if (lStorage[i].shipFunction === this.primaryFunction) sids.push(lStorage[i].sid);
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
    APS.prototype.isSource = function (colony)
    {
        var obj = this.moveables;
        var isSource = false;
        this.demand.forEach(
            function (demand, index) {
                //console.log(colony.balance[obj[demand.item]]);
                if (colony.balance[obj[demand.item]] > 0) isSource = true;
            }
        );
        return isSource;
    };
    APS.prototype.getDistance = function(x, y, exact)
    {
        var s = this.ship;
        return autopilot.getDistance( { x: s.x, y: s.y }, { x: x, y: y }, exact )
    };
    APS.prototype.isAPSbase = function(pid)
    {
        if (this.apcBaseIds.indexOf(pid) > -1) return true;
        return false;
    };
    APS.prototype.planetIsSinkOfDistributor = function(pid, ooi) // planet is sink of another functionally equal distributor APS
    {
        console.log("... is planet sink of another distributor? " + this.apcByDest[pid]);
        if (typeof this.apcByDest[pid] === "undefined") return false; // no APS registered for destination
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid === this.ship.id) continue;
            if (this.apcByDest[pid][i].shipFunction === "dis" && this.apcByDest[pid][i].ooiPriority === ooi) return true;
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
        if (typeof this.apcByDest[pid] === "undefined") return false;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid === this.ship.id) continue; // skip current APS data
            if (this.apcByDest[pid][i].base === pid) continue; // skip APS with their base as destination -> pid is a sink
            if (this.apcByDest[pid][i].shipFunction === "col" && (this.apcByDest[pid][i].ooiPriority === "all" || this.apcByDest[pid][i].ooiPriority === ooi)) return true;
        }
        return false;
    };
    APS.prototype.destinationHasSameAPStype = function(pid, sf, ooi)
    {
        if (typeof this.apcByDest[pid] === "undefined") {
            //console.log("...no APS assigned to destination!");
            return false;
        }
        if (typeof sf === "undefined") sf = this.primaryFunction;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        var conflictAPS = [];
        for (var i = 0; i < this.apcByDest[pid].length; i++)
        {
            if (this.apcByDest[pid][i].sid === this.ship.id) continue;
            if (this.apcByDest[pid][i].base === pid && sf === "col") continue; // if destination (pid) is the base of collector APS
            if (this.apcByDest[pid][i].shipFunction === sf)
            {
                if (ooi === "dur" || ooi === "tri" || ooi === "mol")
                {
                    if (this.apcByDest[pid][i].ooiPriority === "all" || this.apcByDest[pid][i].ooiPriority === ooi) conflictAPS.push(this.apcByDest[pid][i]);
                } else
                {
                    if (this.apcByDest[pid][i].ooiPriority === ooi) conflictAPS.push(this.apcByDest[pid][i]);
                }
            }
        }
        if (conflictAPS.length > 0) {
            return conflictAPS;
        } else
        {
            return false;
        }
    };
    APS.prototype.baseHasSameAPStype = function(pid, sf, ooi)
    {
        if (typeof this.apcByBase[pid] === "undefined") return false;
        if (typeof sf === "undefined") sf = this.primaryFunction;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
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
        if (tP) return (tP.ownerid !== vgap.player.id);
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
        if (futureVoltage < 50) { return "harmless"; }
        else if (futureVoltage >= 50 && futureVoltage < 100) { return "moderate"; }
        else if (futureVoltage >= 100 && futureVoltage < 150) { return "strong"; }
        else if (futureVoltage >= 150 && futureVoltage < 200) { return "dangerous"; }
        else if (futureVoltage >= 200) { return "very dangerous"; }
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
        // avoid planets in close proximity of enemy ships
        for (var j = 0; j < eS.length; j++)
        {
            // only when ship has weapons toDo: or when ship is capable of robbing?
            if (eS[j].armed)
            {
                // check if object is farther away from enemy than current location
                var objectEnemyDist = Math.ceil(autopilot.getDistance( {x: object.x, y: object.y}, {x: eS[j].x, y: eS[j].y} ));
                var apsEnemyDist = Math.ceil(autopilot.getDistance( {x: this.ship.x, y: this.ship.y}, {x: eS[j].x, y: eS[j].y} ));
                if (objectEnemyDist < apsEnemyDist) return true;
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
    APS.prototype.shipTargetInWarpWell = function(s)
    {
        if (typeof s === "undefined") s = this.ship;
        var planet = vgap.planetAt(s.targetx, s.targety);
        if (planet) return false; // target is planet
        var cP = autopilot.getClosestPlanet({x: s.targetx, y: s.targety}, 0, true);
        if (cP)
        {
            return this.shipInWarpWellOfPlanet(cP.planet, {x: s.targetx, y: s.targety});
        } else {
            console.error("...no closest planet found???");
            return false;
        }
    };
    APS.prototype.shipInWarpWellOfPlanet = function(planet, ship)
    {
        if (typeof ship === "undefined") ship = this.ship;
        var distance = Math.ceil(autopilot.getDistance( {x: ship.x, y: ship.y}, {x: planet.x, y: planet.y} ));
        return (distance <= 3);
    };
    /*
     *  positional information
     */
    APS.prototype.objectInside = function(object, inside)
    {
        // toDo: replace objectInsideMinefield/Starcluster/Ionstorm
        if (typeof object === "undefined" || typeof inside === "undefined") return false;
        for (var i = 0; i < inside.length; i++)
        {
            var curDistToMinefieldCenter = Math.floor(autopilot.getDistance({x: inside[i].x, y: inside[i].y}, {x: object.x, y: object.y}));
            if (inside[i].radius > curDistToMinefieldCenter) return true;
        }
        return false;
    };
    APS.prototype.objectCloseTo = function(object, closeTo)
    {
        // toDo: replace objectInsideMinefield/Ionstorm (non-strict)
    };
    APS.prototype.objectInsideEnemyMineField = function(object)
    {
        return this.objectInside(object, autopilot.frnnEnemyMinefields);
    };
    APS.prototype.objectInsideOwnMineField = function(object)
    {
        return this.objectInside(object, autopilot.frnnFriendlyMinefields);
    };
    APS.prototype.objectInsideWebMineField = function(object)
    {
        return this.objectInside(object, autopilot.frnnWebMinefields);
    };
    APS.prototype.objectInsideEnemyWebMineField = function(object)
    {
        return this.objectInside(object, autopilot.frnnEnemyWebMinefields);
    };
    APS.prototype.objectInsideStarCluster = function(object)
    {
        if (typeof object === "undefined") return false;
        var sc = autopilot.frnnStarClusters;
        for (var i = 0; i < sc.length; i++)
        {
            var curDistToStarClusterCenter = autopilot.getDistance({x: sc[i].x, y: sc[i].y}, {x: object.x, y: object.y});
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
        if (typeof coords === "undefined") coords = { x: this.ship.x, y: this.ship.y };
        var planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        var cP = autopilot.getClosestPlanet(coords, 0, true);
        if (cP)
        {
            return this.shipInWarpWellOfPlanet(cP.planet);
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
    APS.prototype.isSafePosition = function(object)
    {
        // ion storms
        var ionStorm = this.objectInsideIonStorm(object);
        if (ionStorm && Math.floor(ionStorm.voltage * 1.2) > 150) // will react earlier (* 1.2)
        {
            console.log("...position is inside ~dangerous ion storm!");
            return false;
        }
        // starclusters
        var radiation = this.objectInsideStarCluster(object);
        if (radiation)
        {
            if (!this.radiationShielding)
            {
                //console.log("...position is inside starcluster radiation zone!");
                return false;
            }
        }
        // mine fields
        var WithinMinefield = this.objectInsideEnemyMineField(object);
        if (WithinMinefield) // don't visit positions in enemy minefields
        {
            console.log("...position is inside minefield!");
            return false;
        }
        var protectedByMinefield = this.objectInsideOwnMineField(object);

        // enemy (ships & planets)
        if (this.objectInRangeOfEnemy(object))
        {
            console.log("...position is close to enemy!");
            if (this.objectGuarded(object) || (protectedByMinefield && !WithinMinefield))
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
        if (typeof direction === "undefined") direction = "asc";
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
                if (categories[j] === collection[k][cluster])
                {
                    clusterCollection.push(collection[k]);
                }
            }
            if (clusterCollection.length > 0)
            {
                if (clusterCollection.length > 1)
                {
                    if (cluster === "eta" && categories[j] === 1)
                    {
                        clusterCollection = autopilot.sortCollection(clusterCollection, "value", "desc");
                    } else {
                        clusterCollection = autopilot.sortCollection(clusterCollection, order, direction);
                    }
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
        //console.log("clustered Collection:");
        //console.log(newCollection);
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
        if (typeof order === "undefined") order = "distance";
        // default order - from low to high (ascending)
        if (typeof direction === "undefined") direction = "asc";
        //
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
        if (this.primaryFunction === "exp")
        {
            devideThresh = Math.floor(0.75 * this.hull.cargo);
        } else
        {
            if (this.objectOfInterest === "neu")
            {
                devideThresh = Math.floor(this.hull.fueltank * this.functionModule.minimalCargoRatioToGo);
            } else if (this.objectOfInterest === "mcs")
            {
                devideThresh = 250;
            } else
            {
                devideThresh = Math.floor(this.hull.cargo * this.functionModule.minimalCargoRatioToGo);
                if (this.objectOfInterest !== "all") devideThresh = Math.floor(devideThresh * 0.75);
                if (this.objectOfInterest === "cla")
                {
                    var baseMaxClans = autopilot.getMaxColonistPopulation(this.base);
                    if (baseMaxClans - this.base.clans < this.hull.cargo * this.functionModule.minimalCargoRatioToGo)
                    {
                        devideThresh = baseMaxClans - this.base.clans;
                    }
                }
            }
        }
        return devideThresh;
    };
    /*
     *  movement
     */
    /*
        APS.estimateNextFuelConsumption
         from (targetPlanet) -> next Destination
         using direct routes:
            ship -> (destination) -> new destination
            ship -> (secondary destination) -> primary destination

     */
    APS.prototype.estimateNextFuelConsumption = function(tP)
    {
        var nextFuel = false;
        //
        var curDistance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: this.ship.x, y: this.ship.y }));
        //
        var thisFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, [], curDistance); // [] = current cargo
        if (this.ship.hullid === 96) thisFuel -= (2 * (curDistance-1)); // cobol ramscoop
        //
        // next destination
        //
        var nD = false;
        if (tP.id === this.destination.id)
        {
            // next destination = new destination

            if (this.primaryFunction === "col")
            {
                if (tP.id !== this.base.id)
                {
                    nD = this.base;
                } else {
                    // toDo: find new destination (from sources)
                    // nD = autopilot.getClosestPlanet({x: tP.x, y: tP.y});
                }
            } else if (this.primaryFunction === "dis")
            {
                // toDo: find new destination (sink or source4Sink)
                // nD = autopilot.getClosestPlanet({x: tP.x, y: tP.y});
            }
        } else if (this.secondaryDestination && tP.id === this.secondaryDestination.id)
        {
            // next destination = primary destination
            nD = this.destination;
        }
        if (nD)
        {
            this.setWaypoints(tP, nD); // tP = next ship position
            var nWP = this.getNextWaypoint(nD, tP);
            if (nWP)
            {
                var distance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: nWP.x, y: nWP.y }));
                var nextCargo = this.estimateMissionCargo(tP);
                if (nextCargo[0] > thisFuel) nextCargo[0] -= thisFuel; // reduce cargo by fuel that is used up traveling to tP
                nextFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, nextCargo, distance);
                if (this.ship.hullid === 96) nextFuel -= (2 * (distance-1)); // cobol ramscoop
            }
        }
        if (!nextFuel) return thisFuel; // as precaution, if no next fuel could be determined, return consumption of prior (this) trip
        return nextFuel;
    };
    APS.prototype.getETA = function( dest, origin )
    {
        var warp = this.ship.engineid;
        if (typeof origin === "undefined" || origin === null) origin = { x: this.ship.x, y: this.ship.y };
        if (typeof dest === "undefined" || dest === null) dest = { x: this.ship.targetx, y: this.ship.targety };
        if (!this.shipPathIsSave(dest, origin))
        {
            warp = 4;
        }
        var ETA = 1;
        var maxTurnDist = Math.pow(warp,2);
        var journeyDist = Math.floor(autopilot.getDistance({ x: origin.x, y: origin.y }, { x: dest.x, y: dest.y }));
        var destIsPlanet = vgap.planetAt(dest.x, dest.y);
        if (destIsPlanet && journeyDist >= 3) journeyDist -= 3; // warp well
        if (journeyDist > maxTurnDist) ETA = Math.ceil(journeyDist / maxTurnDist);
        return ETA;
    };
    APS.prototype.checkFuel = function(cargo)
    {
        console.log("::>checkFuel");
        //if (typeof this.planet === "undefined") return true;
        if (typeof cargo === "undefined") cargo = [];
        this.setWarp(); // set warp factor according to current circumstances
        var fuel = Math.ceil(autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, cargo));
        if (!fuel) return false;
        console.log("...required fuel: " + fuel);
        //
        //  toDo: export to own function or merge with estimateNextFuelConsumption
        var tP = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (tP)
        {
            var nextFuel = 0;
            if (tP.neutronium > -1) // ownPlanet
            {
                nextFuel = this.estimateNextFuelConsumption(tP);
                console.log("...required fuel at next waypoint: " + nextFuel);
                if (nextFuel > tP.neutronium)
                {
                    fuel += (nextFuel - tP.neutronium);
                }
            } else
            {
                // toDo: exp and other?
                // todo: we can also use estimate but have to adapt the subroutine (estimateNextFuelConsumption) to accomodate expanders!
                nextFuel = fuel; // provide basic fuel backup for (empty) return trip from unowned planet..
                //console.log("...basic backup fuel: +" + fuel);
                fuel += nextFuel;
            }
        }
        //
        //
        var diff = fuel - this.ship.neutronium;
        console.log("...ship has " + this.ship.neutronium + ", need additional " + diff + " = " + fuel);
        if (diff <= 0) return true; // if there is enough, we don't need to load fuel
        // else, try to load
        var loadedFuel = 0;
        if (this.planet && this.isOwnPlanet) // only load if we are in orbit around one of our planets
        {
            console.log("...planet has " + this.planet.neutronium);
            loadedFuel = this.loadObject("fuel", this.planet, diff); // loading "FUEL" overwrites balance limitation (in contrast to "neutronium"), returns amount on board after loading
            console.log("...fuel loaded: " + loadedFuel);
        } else if (this.planet && this.isUnownedPlanet)
        {
            if (this.ship.mission !== 10) this.ship.mission = 10; // we set the ship mission to "beam up fuel"
            // if (this.ship.mission !== 6) loadedFuel = this.planet.neutronium; // unless the ship is currently towing, we simulate actual loading, so warp will be set
            // toDo: towing is not yet part of any APS activity, if this should change,
            // toDo: this needs to be thought through: we would need to store the fact, that the ship actually was towing (storage.formerShipMission)
        } else
        {
            // we are in space // toDo: can we transfer fuel from another ship?
        }
        //
        if (this.ship.neutronium >= fuel) // after loading, there is enough!
        {
            return true;
        } else if (this.planet && this.ship.mission === 10 && this.ship.neutronium + this.planet.neutronium >= fuel) // if gather neutronium will be enough...
        {
            return true;
        } else if (this.ship.hullid === 14) // hull 14 = Neutronic Fuel Carrier
        {
            return true;
        } else
        {
            if (this.planet)
            {
                this.setWarp(0);
                this.idleTurns = 1;
                if (this.isIdle) this.idleTurns += 1;
                this.isIdle = true;
                if (this.idleReason.indexOf("fuel") === -1) this.idleReason.push("fuel");
                return false;
            } else
            {
                // in space with insufficient fuel to reach current target...
                return false;
            }
        }
    };
    APS.prototype.setWarp = function(warp)
    {
        this.ship.warp = 0;
        if (typeof warp === "undefined")
        {
            this.ship.warp = this.ship.engineid;
        } else
        {
            this.ship.warp = warp;
        }
        if (this.targetIsSet())
        {
            // reduce speed to warp 4, if we are currently inside a minefield
            if (this.objectInsideEnemyMineField( {x: this.ship.x, y: this.ship.y} ) && this.ship.engineid > 4) this.ship.warp = 4;
            // reduce speed to warp 3, if we are currently inside a web minefield
            if (this.objectInsideEnemyWebMineField( {x: this.ship.x, y: this.ship.y} ) && this.ship.engineid > 3) this.ship.warp = 3;
            // set warp 1 if we are moving into or inside warp well
            if (this.inWarpWell || this.shipTargetInWarpWell(this.ship)) this.ship.warp = 1;
        }
        // update fuelFactor
        this.fFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp];
    };
    APS.prototype.targetIsSet = function()
    {
        return autopilot.shipTargetIsSet(this.ship);
    };
    APS.prototype.escapeToWarpWell = function()
    {
        if (this.inWarpWell)
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
        return true;
        /*
        // toDo: get minefields centered within a range of the current position; range = distance to travel???
        //console.log("::>shipPathIsSave");
        if (typeof oP === "undefined" || oP === null) oP = this.ship;
        //console.log("..." + oP.id + " -> " + tP.id);
        var sx1 = oP.x;
        var sy1 = oP.y;
        var sx2 = tP.x;
        var sy2 = tP.y;
        for (var i = 0; i < autopilot.frnnEnemyMinefields.length; i++)
        {
            var mF = autopilot.frnnEnemyMinefields[i];
            if (this.shipPathIntersectsObject(sx1, sy1, sx2, sy2, mF.x, mF.y, mF.radius))
            {
                //console.log("...path intersects with enemy minefield " + mF.id);
                //return false; // deactivated 22.03.17: does not work as expected!
            }
        }
        return true;
        */
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
    APS.prototype.getTurnRange = function(warp, turns)
    {
        return (Math.pow(warp,2)*turns);
    };
    /*
     *  waypoint selection specifics
     */
    /*
     *  setShipTarget
     *      calls functionModule.setSecondaryDestination
     *      determines next waypoint and sets waypoint as ship target
     *
     *      called in setMissionDestination (phase 2)
     *      and initializeBoardComputer (setup APS, update configuration, setShipTarget OR set flag to determine potential destination first)
     */
    APS.prototype.setShipTarget = function(dP)
    {
        // if no secondary destination is set, check if one is necessary
        // if we are at last destination and a secondary destination is set, re-check if this is still necessary
        if (!this.secondaryDestination || (this.lastDestination.id === this.planet.id && this.secondaryDestination)) this.functionModule.setSecondaryDestination(this);
        //
        if (this.secondaryDestination) dP = this.secondaryDestination;
        if (this.planet && dP.id === this.planet.id) return; // we are at primary or secondary destination! Need to find another destination!
        console.log(dP);
        console.log("...searching waypoints to " + dP.name + " (" + dP.id + ").");
        this.setWaypoints(this.ship, dP);
        var target = this.getNextWaypoint(dP);
        if (target)
        {
            console.log("...fly to " + target.id);
            this.ship.targetx = target.x;
            this.ship.targety = target.y;
            var wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
        }
    };
    APS.prototype.setWaypoints = function(ship, dP)
    {
        // toDo: warpwell minimum distance used, how to implement heading consideration (warpwell max dist = 3)
        this.functionModule.setPotentialWaypoints(this); // potential waypoints specific for the current function (e.g. own planets in case of collector and distributor)
        var ship2dest = Math.ceil(autopilot.getDistance( {x: ship.x , y: ship.y}, {x: dP.x , y: dP.y} ));
        var waypoints = this.getTargetsInRange(this.potentialWaypoints, dP.x, dP.y, ship2dest); // potential waypoints closer to dP
        waypoints.push({ x: dP.x, y: dP.y });
        //console.log("...raw waypoints:");
        var fWPs = [];
        for (var i = 0; i < waypoints.length; i++) // set/save waypoint information
        {
            var pW = vgap.planetAt(waypoints[i].x, waypoints[i].y);
            if (pW && this.isSavePlanet(pW))
            {
                var etaDist = Math.ceil(autopilot.getDistance( {x: pW.x , y: pW.y}, {x: ship.x , y: ship.y} )-2.2); // - warpwell of pW
                if (this.planet) etaDist -= 2.2; // - warpwell of this.planet
                if (ship2dest < etaDist || etaDist <= 0) continue; // skip waypoints past dP and this.planet
                var pW2dPDist = Math.ceil(autopilot.getDistance( {x: pW.x , y: pW.y}, {x: dP.x , y: dP.y} )-4.4); // - warpwell of pW and dP
                waypoints[i].pid = pW.id;
                waypoints[i].ship2wPDist = etaDist;
                waypoints[i].wayp2dPDist = pW2dPDist;
                waypoints[i].ship2dPDist = ship2dest;
                waypoints[i].ship2wP2dPDist = etaDist + pW2dPDist;
                waypoints[i].wpETA = Math.ceil(etaDist / Math.pow(this.ship.engineid, 2)) + Math.ceil(pW2dPDist / Math.pow(this.ship.engineid, 2));
                // ETA if using pW as next stop
                fWPs.push(waypoints[i]);
            }
        }
        //console.log(fWPs);
        this.potentialWaypoints = fWPs;
    };
    APS.prototype.getNextWaypoint = function(dP, cP, notDP)
    {
        if (typeof notDP === "undefined") notDP = false;
        if ((typeof cP === "undefined" || cP === null) && this.planet) cP = this.planet;
        if ((typeof cP === "undefined" || cP === null) && !this.planet) cP = this.ship;
        //console.log("::>getNextWaypoint (" + cP.id + "->" + dP.id + ")");
        var target = false;
        var inOwnMinefield = this.objectInsideOwnMineField(cP);
        //console.log("...objectInsideOwnMineField = " + inOwnMinefield);
        var urgendWaypoint = this.getUrgentWaypoint(dP, cP);
        if (urgendWaypoint && !inOwnMinefield && !notDP)
        {
            target = urgendWaypoint;
        } else {
            target = this.getEtaWaypoint(dP, cP, notDP);
        }
        return target;
    };
    APS.prototype.destinationAmongWaypoints = function(dP, pW)
    {
        var destination = dP;
        if (this.secondaryDestination)
        {
            destination = this.secondaryDestination;
        }
        for (var i = 0; i < pW.length; i++)
        {
            if (pW[i].pid === destination.id) return true;
        }
        return false;
    };
    APS.prototype.getWaypointsByUrgency = function(dP, origin)
    {
        if (typeof origin === "undefined") origin = this.ship;
        if (this.potentialWaypoints.length === 0) this.setWaypoints(origin, dP); // ensure potential waypoints have been set
        var waypoints = this.potentialWaypoints;
        //console.log("...waypoints by urgency:");
        var dDist = autopilot.getDistance( {x: origin.x , y: origin.y}, {x: dP.x , y: dP.y} )-2.2;
        if (this.planet) dDist -= 2.2; // warpWell
        var dETA = Math.ceil(dDist / Math.pow(this.ship.engineid, 2));
        //console.log("...direct ETA: " + dETA + " (" + dDist + ")");
        var uWPs = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            //console.log("...waypoint ETA: " + waypoints[i].wpETA + " (" + waypoints[i].ship2wP2dPDist + ")");
            if (waypoints[i].wpETA <= (dETA + 1)) uWPs.push(waypoints[i]);
        }
        if (uWPs.length > 1) uWPs = this.clusterSortCollection(uWPs, "wpETA", "wayp2dPDist");
        //console.log(uWPs);
        return uWPs;
    };
    APS.prototype.getUrgentWaypoint = function(dP, origin)
    {
        if (typeof origin === "undefined" || origin === null) origin = this.ship;
        var urgentWaypoints = this.getWaypointsByUrgency(dP, origin);
        if (urgentWaypoints.length < 1) return false;
        var uWP = false;
        //console.log("...urgent waypoint:");
        if (this.destinationAmongWaypoints(dP, urgentWaypoints) && this.isSavePlanet(dP) && this.shipPathIsSave(dP))
        {
            uWP = dP;
        } else if (this.destinationAmongWaypoints(dP, urgentWaypoints))
        {
            //console.log("...planet not safe: " + this.isSavePlanet(dP));
            //console.log("...ship path not safe: " + this.shipPathIsSave(dP));
        }
        if (!uWP)
        {
            if (urgentWaypoints.length > 1)
            {
                urgentWaypoints = autopilot.sortCollection(urgentWaypoints, "distance");
            }
            for (var i = 0; i < urgentWaypoints.length; i++)
            {
                var pW = vgap.planetAt(urgentWaypoints[i].x, urgentWaypoints[i].y);
                if (this.isSavePlanet(pW))
                {
                    var inWarpWell = this.shipInWarpWellOfPlanet(pW, origin);
                    if (inWarpWell || this.shipPathIsSave(pW))
                    {
                        if (inWarpWell)
                        {
                            console.log("...return to orbit of " + pW.id);
                        } else {
                            console.log("...fly to " + pW.id);
                        }
                        uWP = pW; break;
                    } else
                    {
                        console.log("...ship path not safe");
                    }
                } else {
                    console.log("...planet not safe");
                }
            }
        }
        //console.log(uWP);
        return uWP;
    };
    APS.prototype.getWaypointsByEta = function(dP, origin, not)
    {
        if (typeof origin === "undefined") origin = this.ship;
        if (typeof not === "undefined") not = []; // planet ids to exclude
        if (this.potentialWaypoints.length === 0) this.setWaypoints(origin, dP); // ensure potential waypoints have been set
        var waypoints = this.potentialWaypoints;
        //console.log("...waypoints by ETA:");
        var wpByEta = {};
        var ETAs = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            if (not.indexOf(waypoints[i].pid) > -1) continue;
            var eta = Math.ceil(waypoints[i].ship2wPDist / Math.pow(this.ship.engineid, 2));
            if (eta === 0) continue;
            ETAs.push(eta);
            // toDo: merge the first two categories (e.g. 1+2 or 1+3 or 2+3...)?
            if (typeof wpByEta[eta] === "undefined")
            {
                wpByEta[eta] = [waypoints[i]];
            } else {
                wpByEta[eta].push(waypoints[i]);
            }
        }
        for (var j = 0; j < ETAs.length; j++)
        {
            var curETA = ETAs[j];
            if (typeof wpByEta[curETA] !== "undefined")
            {
                wpByEta[curETA] = autopilot.sortCollection(wpByEta[curETA], "ship2wP2dPDist"); // waypoints prioritized by smallest deviation from direct route to dP
            }
        }
        //console.log(wpByEta);
        return wpByEta;
    };
    APS.prototype.getEtaWaypoint = function(dP, origin, notDP)
    {
        if (typeof notDP === "undefined") notDP = false;
        if (typeof origin === "undefined" || origin === null) origin = this.ship;
        var not = []; // planet ids to exclude
        var waypoints = this.getWaypointsByEta(dP, origin, not);
        var target = false;
        //console.log("...ETA waypoint:");
        var minETA = 0;
        for (var j = 1; j < 5; j++)
        {
            if (typeof waypoints[j] !== "undefined")
            {
                console.log("...potential waypoints with ETA " + j);
                //waypoints[j] = this.sortCollection(waypoints[j]);
                console.log(waypoints[j]);
                if (minETA === 0)
                {
                    minETA = j; // clostest waypoints (minimal ETA)
                    if (!notDP && this.destinationAmongWaypoints(dP,waypoints[j]) && this.isSavePlanet(dP) && this.shipPathIsSave(dP))
                    {
                        console.log("...potential waypoints contain destination!");
                        target = dP; break;
                    }
                }
                for (var i = 0; i < waypoints[j].length; i++)
                {
                    var pW = vgap.planetAt(waypoints[j][i].x, waypoints[j][i].y);
                    if (notDP && pW.id === dP.id) continue;
                    // if ETA is bigger (when using pW as next target) than the ETA from current position to destination (direct route) AND pW is not dP...
                    // if (waypoints[j][i].wpETA >= this.getETA(dP,origin) && pW.id !== dP.id) continue;
                    if (this.shipInWarpWellOfPlanet(pW) && this.isSavePlanet(pW))
                    {
                        console.log("...return in orbit of " + pW.id);
                        target = pW; break;
                    } else if (this.isSavePlanet(pW) && this.shipPathIsSave(pW))
                    {
                        target = pW; break;
                    }
                }
            }
            if (target) break;
        }
        //console.log(target);
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
        if (typeof turns === "undefined") turns = 1;
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
        if (typeof turns === "undefined") turns = 1;
        if (typeof planet === "undefined")
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
        var tC = new Colony(tP.id);
        var cargo = [];
        if (this.primaryFunction === "col")
        {
            if (tP.id === this.base.id)
            {
                cargo = [ 0 ];
            } else
            {
                var available = tC.getSumForCargo(this.primaryFunction, this.objectOfInterest);
                if (available > this.hull.cargo)
                {
                    cargo = [ this.hull.cargo ];
                } else {
                    cargo = [ available ];
                }
            }
        } else if (this.primaryFunction === "dis")
        {
            cargo = [ 0 ];
            if (this.secondaryDestination)
            {
                if (tP.id === this.secondaryDestination.id)
                {
                    // primary deficiency
                    var cargoSum = 0;
                    //var sinkRequest = this.functionModule.getObjectDeficiency(this.destination) * -1;
                    var c = new Colony(this.destination.id);
                    var sinkRequest = c.balance[this.moveables[this.objectOfInterest]];
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
                if (tP.id !== this.destination.id)
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
        // general filtering of potential destinations (e.g. remove destinations located in problematic zones)
        var filteredDest = [];
        var avoidDest = [];
        console.log("...filtering destinations: " + this.potDest.length);
        for (var i = 0; i < this.potDest.length; i++)
        {
            var potPlanet = vgap.getPlanet(this.potDest[i].pid);
            if (potPlanet.id === this.base.id && this.isSavePlanet(potPlanet)) // our base, if save, is always a valid target
            {
                filteredDest.push(this.potDest[i]);
            } else
            {
                // toDo: current planet can't be a mission destination ?
                // if (this.planet && potPlanet.id === this.planet.id && this.primaryFunction !== "dis") continue;
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
                console.log("Setting destination of APS...");
                console.log(this.potDest);
                if (typeof this.potDest[0].planet !== "undefined")
                {
                    // toDo: transition to using colony objects directly (with the exception of expander?)
                    // - builder is using this
                    // - ...
                    dP = vgap.planetAt(this.potDest[0].planet.x, this.potDest[0].planet.y);
                } else
                {
                    dP = vgap.planetAt(this.potDest[0].x, this.potDest[0].y);
                }
            }
            if (this.destination) this.lastDestination = this.destination;
            this.destination = dP;
            this.functionModule.setDemand(this);
            this.functionModule.setCurrentOoi(this);
            this.updateStoredData();
        }
        //
        if (dP && (this.planet || this.inWarpWell))
        {
            this.setShipTarget(dP);
            this.setWarp();
        } else
        {
            // idle
            this.ship.targetx = this.ship.x;
            this.ship.targety = this.ship.y;
        }
    };
    APS.prototype.reduceCargoToProceed = function()
    {
        console.log("...checking if reducing cargo will help.");
        if (this.isOwnPlanet)
        {
            // check how long we have been idle
            var idleTurns = 0;
            var i = 0;
            if (this.idleTurns) idleTurns = vgap.game.turns - this.idleTurns;
            var futRes = autopilot.getFuturePlanetResources(this.planet);
            if (futRes.neutronium > 10 && idleTurns === 0) return false; // wait at least one turn if there will be more fuel next turn
            // check how much we need to reduce the cargo, so we can continue...
            var curCargo = [this.ship.duranium, this.ship.tritanium, this.ship.molybdenum, this.ship.supplies, this.ship.clans];
            var futCargo = curCargo;
            var fraction = 0.9;
            while (!this.checkFuel(futCargo) && fraction > 0)
            {
                futCargo = [];
                for (i = 0; i < curCargo.length; i++)
                {
                    futCargo.push(Math.floor(curCargo[i] * fraction));
                }
                fraction -= 0.1;
            }
            console.log("...to continue, we would need to reduce our cargo to " + (fraction*100) + "%");
            if (fraction > 0.7)
            {
                // unload
                var unloadingSequence = ["duranium", "tritanium", "molybdenum", "supplies", "clans"];
                for (i = 0; i < futCargo.length; i++)
                {
                    this.unloadObject(unloadingSequence[i], this.planet, (this.ship[unloadingSequence[i]] - parseInt(futCargo[i])));
                }
                // set warp
                return true;
            }
        }
        this.setWarp(0);
        return false;
    };
    APS.prototype.thereIsACloserWaypoint = function(cWp)
    {
        console.log("...checking if a closer WP is available.");
        // toDo: this is ineffective... what if the current target is not dP but there is a closer
        this.setWaypoints(this.ship, cWp);
        var nWP = this.getNextWaypoint(cWp, null, true);
        if (nWP && nWP.id !== cWp.id)
        {
            this.ship.targetx = nWP.x;
            this.ship.targety = nWP.y;
            var wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
            return this.checkFuel();
        }
        return false;
    };
    APS.prototype.thereIsACloserPlanetWithEnoughFuel = function()
    {
        console.log("...checking if a closer planet with fuel is available.");
        return false;
    };
    /*
     *  confirmMission: PHASE 3
     *      - calls functionModule.handleCargo (second time)
     *      - verifies that a target has been set, determines the reason why not
     *      - checks Fuel, tries to resolve fuel issues
     *      - set ship idle and idle Reason
     */
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
                this.idleTurns = 0;
            } else {
                console.warn("...checkfuel failed.");
                if (this.waypoint && this.thereIsACloserWaypoint(this.waypoint))
                {
                    // true = we can reach another possible waypoint with the available fuel
                    console.info("...but we can reach another waypoint.");
                    this.isIdle = false;
                } else if (this.thereIsACloserPlanetWithEnoughFuel())
                {
                    // true = a planet closer to the current position and farther away from the destination / actual waypoint with enough fuel
                    // to support the travel to the actual waypoint can be approached
                    console.info("...but we can reach another planet with enough fuel.");
                    this.isIdle = false;
                } else if (this.planet && this.getCargoCapacity() !== this.hull.cargo && this.reduceCargoToProceed() && this.primaryFunction !== "exp")
                {
                    // true = reduction of cargo helped to continue
                    // this can be limited to a certain degree (maximum reduction, wait at least one turn or not)
                    console.info("...but we can reach target with reduced cargo.");
                    this.isIdle = false;
                } else
                {
                    console.warn("...are we in warpwell? " + this.inWarpWell);
                    if (this.inWarpWell)
                    {
                        // try returning to planet
                        var cP = autopilot.getClosestPlanet({ x: this.ship.x, y: this.ship.y }, 0, true);
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
                    if (this.planet)
                    {
                        if (!this.isSavePlanet(this.planet))
                        {
                            this.escapeToWarpWell();
                            this.isIdle = false;
                        }
                    } else
                    {
                        // in space
                        console.warn("...idle in space!");
                    }
                }
            }
        } else
        {
            if (this.destination)
            {
                console.warn("...no target acquired (idle).");
                this.isIdle = true;
                this.idleTurns = vgap.game.turn;
                if (this.idleReason.indexOf("target") === -1) this.idleReason.push("target");
                if (this.planet && !this.isSavePlanet(this.planet))
                {
                    this.escapeToWarpWell();
                    if (this.idleReason.indexOf("unsafe") === -1) this.idleReason.push("unsafe");
                }
            } else
            {
                if (this.ship.neutronium < 1)  // make sure fuel is aboard, except for merlin alchemy
                {
                    if  (this.planet.neutronium > 0)
                    {
                        if (this.ship.hullid !== 105) this.loadObject("fuel", this.planet, 1);
                    } else
                    {
                        if (this.ship.hullid !== 105)
                        {
                            this.isIdle = true;
                            this.idleTurns = vgap.game.turn;
                            if (this.idleReason.indexOf("fuel") === -1) this.idleReason.push("fuel");
                        }
                    }
                }
                if (this.primaryFunction === "alc") {
                    this.functionModule.updateFC(this);
                } else if (this.primaryFunction === "ter" && this.functionModule.getCurDeficiency(this))
                {
                    this.destination = this.planet;
                } else if (this.primaryFunction === "hiz" && this.functionModule.getMissionStatus(this) < 1)
                {
                    this.destination = this.planet;
                } else
                {
                    this.isIdle = true;
                    this.idleTurns = vgap.game.turn;
                    if (this.idleReason.indexOf("dest") === -1) this.idleReason.push("dest");
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
    /*
        CHECK IF MISSION STILL IS A VALID MISSION
     */
    APS.prototype.validateMission = function(potPlanet)
    {

    };
    APS.prototype.getMissionConflict = function(potPlanet)
    {
        // todo: module specific handling
        if (potPlanet.id === this.base.id) return false; // exclude base planet from evaluation
        if (this.primaryFunction === "exp") return this.functionModule.hasMissionConflict(this, potPlanet);
        /*
            MISSION
         */
        /*
            DESTINATION ALREADY MISSION OF APS TYPE
         */
        var conflictAPS = this.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
        if (conflictAPS)
        {
            console.log("..." + conflictAPS.length + " other APS approaching " + potPlanet.id);
            // toDo: reconsider if another APS will drop something off...
            //
            // only count as conflict if there is not enough resources available
            var sumOfAllCargo = this.getSumOfOOI(conflictAPS);
            if (this.objectOfInterest === "neu")
            {
                sumOfAllCargo += this.hull.fueltank; // add tank capacity of current APS
            } else {
                sumOfAllCargo += this.hull.cargo; // add hull cargo of current APS
            }
            var sumOfResources = 0;
            if (this.objectOfInterest === "all")
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
                if (storedGameData[i].sid === this.ship.id) continue; // skip data from current APS

                // storage APS ship object
                var curShip = vgap.getShip(storedGameData[i].sid);
                if (curShip)
                {
                    // current location of storage APS
                    var curShipPlanet = vgap.planetAt(curShip.x, curShip.y);
                    // special case of expander.... if an expander is at an unowned planet and transferring,
                    // the planet will still be recognized as unowned and another expander will see the planet as a potential target for colonization
                    // toDo: remove those kind of planets from unownedPlanet collection
                    if (curShipPlanet && curShipPlanet.id === potPlanet.id && this.primaryFunction === "exp" && !this.functionModule.isSource(potPlanet))
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
            var idle = "";
            if (this.isIdle)
            {
                idle = " !IDLE:";
                if (this.idleReason.length > 0)
                {
                    idle += this.idleReason.join(",");
                }
                idle += "!";
            } else {
                if (this.destination)
                {
                    if (this.destination.id === this.base.id && this.primaryFunction === "col")
                    {
                        destination = "home";
                    } else
                    {
                        destination = this.destination.id;
                    }
                }
            }
            var secDest = "";
            if (this.secondaryDestination)
            {
                secDest = this.secondaryDestination.id;
            }
            var ooiText = autopilot.apsOOItext[this.primaryFunction][this.objectOfInterest];
            var funcText = autopilot.apsOOItext[this.primaryFunction].name;
            note.body = "Base " + this.base.id + ", ";
            if (destination === "home")
            {
                note.body += "returning to base with " + ooiText + idle;
            } else {
                if (this.primaryFunction === "col")
                {
                    ooiText += " from";
                } else if (this.primaryFunction === "dis")
                {
                    if (secDest === "")
                    {
                        ooiText += " to";
                    } else
                    {
                        funcText = "collecting";
                        ooiText += " from";
                        destination = secDest;
                    }

                } else if (this.primaryFunction === "exp")
                {
                    ooiText = "planet";
                }
                note.body += funcText + " " + ooiText + " " + destination + idle;
            }
            note.color = this.noteColor;
        } else
        {
            note.body = " ";
            note.color = "000000";
        }
    };
    // interaction specifics
    APS.prototype.satisfyOtherDeficiencies = function (sP, simu, ooi)
    {
        if (typeof sP === "undefined") sP = this.planet; // source Planet
        if (typeof simu === "undefined") simu = false; // simu true = only simulate, do not load anything, return sum of deficiencies (except mcs)
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        var finalCargo = 0;
        // try to satisfy other deficiencies
        var dC = new Colony(this.destination.id);
        var pC = new Colony(sP.id);
        for (var i = 0; i < this.deficiencies.length; i++)
        {
            if (ooi === this.deficiencies[i]) continue;
            var thisObj = this.moveables[this.deficiencies[i]];
            //var otherDef = Math.floor(this.functionModule.getObjectDeficiency(this.destination, this.deficiencies[i])) * -1;
            var otherDef = Math.floor(dC.balance[thisObj]);
            var otherExc = Math.floor(pC.balance[thisObj]);
            if (otherExc < otherDef) otherDef = otherExc;
            if (otherDef > 0 && this.ship[thisObj] < otherDef && pC.isOwnPlanet)
            {
                if (this.ship[thisObj] > 0) otherDef -= this.ship[thisObj]; // reduce deficiency by what is already onboard
                console.log("...satisfying other (" + thisObj + ") deficiency :" + otherDef);
                if (thisObj !== "megacredits") finalCargo += otherDef;
                if (!simu) this.loadObject(thisObj, sP, otherDef);
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
        var unloaded = 0;
        if (this.primaryFunction === "exp")
        {
            this.functionModule.transferCargo(this);
        } else if (this.planet && this.isOwnPlanet)
        {
            var unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
            for (var i = 0; i < unloadingSequence.length; i++)
            {
                var cargo = unloadingSequence[i];
                unloaded += this.unloadObject(cargo, this.planet, parseInt(this.ship[cargo]));
            }
        }
        console.log("[" + this.ship.id + "]-| unloadCargo: " + unloaded);
    };
    APS.prototype.loadMegacredits = function(from, amount)
    {
        if (typeof amount === "undefined") amount = from.megacredits;
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
        if (typeof amount === "undefined") amount = this.ship[object];
        // ...amount is more than what is available, then only unload the latter amount
        if (amount > this.ship[object]) amount = this.ship[object];
        // now unload, planets have unlimited cpacity... no need to check
        this.ship[object] -= amount;
        to[object] += amount;
        to.changed = 1;
        return amount;
    };
    APS.prototype.transferObject = function(object, to, amount)
    {
        var actAmount = 0;
        if (typeof amount === "undefined") {
            // if amount is not defined, unload all
            actAmount = this.ship[object];
        } else {
            // if it is defined use it, unless...
            actAmount = amount;
            // ...amount is more than what is available, then only unload the latter amount
            if (amount > this.ship[object]) actAmount = this.ship[object];
        }
        // now set to transfer, planets have unlimited cpacity... no need to check
        console.log("...TRANSFERRING" + actAmount + " of " + object + " to planet.");
        this.ship[object] -= actAmount;
        this.ship["transfer" + object] += actAmount;
        this.ship.transfertargetid = to.id;
        this.ship.transfertargettype = 1; // planet; toDo: detect if ship-to-ship (2) or ship-to-planet (1)
        to.changed = 1;
        // return actAmount;
        return this.ship[object];
    };
    /*
     *  APS.loadObject
     *      transfers cargo object from planet to ship
     *      -object: name of the object (e.g. neutronium)
     *      -from: vgap.planet
     *      -requestAmount: optional, will load excess of object by default
     *      *requestAmount is safe, as long as Colony data is accurate
     */
    APS.prototype.loadObject = function(object, from, requestAmount)
    {
        if (typeof from === "undefined") from = this.planet;
        var c = new Colony(from.id);
        if (c.isOwnPlanet)
        {
            var curCapacity = this.getCurCapacity(object);
            if (curCapacity <= 0) return 0;
            var excess = c.balance[object];
            // FUEL BALANCE EXCEPTIONS
            if (object === "fuel") excess = from.neutronium; // overwrite balance
            if (object === "fuel") object = "neutronium";
            // ALCHEMY BALANCE EXCEPTION
            if (object === "supplies" && this.primaryFunction === "alc") excess = from.supplies; // overwrite balance
            // EXPANDER BALANCE EXCEPTIONS
            if (object === "supplies" && this.primaryFunction === "exp" && c.hasStarbase) excess = from.supplies - autopilot.settings.defSupRetention; // overwrite balance
            if (object === "megacredits" && this.primaryFunction === "exp" && c.hasStarbase) excess = from.megacredits - autopilot.settings.defMcsRetention; // overwrite balance
            //
            if (excess <= 0) return 0;
            //
            // check requested amount
            //
            var actAmount = excess; // greedy default
            if (typeof requestAmount !== "undefined" && requestAmount > 0 && requestAmount < excess) actAmount = requestAmount;
            //
            // now check ship capacity
            //
            if (curCapacity >= actAmount)
            {
                if (parseInt(actAmount) <= from[object])
                {
                    this.ship[object] += parseInt(actAmount);
                    from[object] -= parseInt(actAmount);
                    this.ship.changed = 1;
                    from.changed = 1;
                } else
                {
                    actAmount = from[object];
                    this.ship[object] += from[object];
                    from[object] -= from[object];
                    this.ship.changed = 1;
                    from.changed = 1;
                }
            } else
            {
                if (parseInt(curCapacity) <= from[object])
                {
                    actAmount = curCapacity;
                    this.ship[object] += curCapacity;
                    from[object] -= curCapacity;
                    this.ship.changed = 1;
                    from.changed = 1;
                } else
                {
                    actAmount = from[object];
                    this.ship[object] += from[object];
                    from[object] -= from[object];
                    this.ship.changed = 1;
                    from.changed = 1;
                }
            }
            console.log("loadObject " + object + " from " + from.id + ": " + actAmount);
            return actAmount;
        }
        return false;
    };
    APS.prototype.updateStoredData = function()
    {
        var destination = false;
        if (this.destination) destination = this.destination.id;
        var sDestination = false;
        if (this.secondaryDestination) sDestination = this.secondaryDestination.id;
        var lDestination = false;
        if (this.lastDestination) lDestination = this.lastDestination.id;
        this.storedData = {
            sid: this.ship.id,
            base: this.base.id,
            destination: destination,
            secondaryDestination: sDestination,
            lastDestination: lDestination,
            shipFunction: this.primaryFunction,
            oShipMission: this.oShipMission,
            ooiPriority: this.functionModule.ooiPriority,
            currentOoi: this.currentOoi,
            idle: this.isIdle,
            idleReason: this.idleReason,
            idleTurns: this.idleTurns
        };
        autopilot.syncLocalStorage(this.storedData);
    };
    APS.prototype.isValidDestination = function(destination)
    {
        if (destination)
        {
            var destPlanet = vgap.getPlanet(destination);
            if (destPlanet) return (destPlanet.ownerid === vgap.player.id || destPlanet.ownerid === 0);
        }
        return false;
    };
    // planet specifics
    APS.prototype.sellSupply = function(useBalance, amount)
    {
        console.log("->>>> SELL SUPPLY");
        var p = this.planet;
        var c = new Colony(p.id);
        if (typeof amount === "undefined") amount = p.supplies;
        if (typeof useBalance === "undefined") useBalance = true;
        var available = p.supplies;
        if (useBalance && c.balance.supplies <= p.supplies) available = c.balance.supplies;
        if (available <= 0) return false;
        if (amount > available) amount = available;
        p.supplies -= amount;
        p.suppliessold += amount;
        p.megacredits += amount;
        p.changed = 1;
        return amount;
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
    APS.prototype.getObjectExcess = function(subject, object)
    {
        if (typeof object === "undefined") object = this.objectOfInterest;
        var tValue = autopilot.getSumAvailableObjects(subject, object, this.primaryFunction);
        if (object === "fuel")
        {
            tValue = this.planet.neutronium;
        } else if (object === "alchemy")
        {
            tValue = this.planet.supplies;
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
    APS.prototype.getCurCapacity = function(object)
    {
        if (object === "neutronium" || object === "fuel") return this.getFuelCapacity();
        if (object === "megacredits") return (10000-this.ship.megacredits);
        return this.getCargoCapacity();
    };
    APS.prototype.getFuelCapacity = function()
    {
        return (parseInt(this.hull.fueltank) - parseInt(this.ship.neutronium));
    };
    APS.prototype.getCargoCapacity = function()
    {
        var cargoCapacity = this.hull.cargo;
        //console.log("cargoCapacity = " + cargoCapacity);
        var components = [
            this.ship.duranium,
            this.ship.tritanium,
            this.ship.molybdenum,
            this.ship.supplies,
            this.ship.ammo, // torpedos or fighters
            this.ship.clans
        ];
        components.forEach(function(comp) { cargoCapacity -= parseInt(comp); });
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
        if (typeof this.functionModule.turnRangeAmp !== "undefined") amp = this.functionModule.turnRangeAmp;
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
        if (typeof fuel === "undefined") fuel = this.ship.neutronium;
        var maxTurns = 0;
        var penalty = 0;
        if (this.hull.cancloak) // toDo: && ship.mission === 9 && !hull.special.match(/advanced Cloak/)
        {
            var minPenalty = 5;
            var massPenalty = Math.ceil(this.hull.mass / 20);
            if (massPenalty > minPenalty)
            {
                penalty += massPenalty;
            } else
            {
                penalty += minPenalty;
            }
        } // toDo: other additional fuel requirenment
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
 * Autopilot - Alchemy Module
 */
function alchemyAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.turnRangeAmp = 1;
    this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.ooiPriority = "all"; // object of interest (ooi) priority: always "cla"
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
alchemyAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
};
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
alchemyAPS.prototype.isSource = function(aps)
{
    var c = new Colony(aps.planet.id);
    if (c.balance.supplies > 0) return true;
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
        var loaded = aps.loadObject("supplies");
        console.log("Cargo load summary: " + loaded);
    }
};
alchemyAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
alchemyAPS.prototype.loadCargo = function(aps)
{

};/*
 *
 * Autopilot - Distributor Module
 *      - destination is always a sink
 *      - if current planet or ship does not hold the required resources, a secondary destination is selected and approached first
 *      - will approach sink, if cargo holds sufficient material
 */
function builderAPS()
{
    /*
        REQUIRED
     */
    this.minimalCargoRatioToGo = autopilot.settings.disMinCapacity; // percent of cargo capacity (e.g. 0.7 = 70%)
    this.devideThresh = 0;
    this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
    /*
        MODUL SPECIFIC
     */
    this.scopeRange = autopilot.settings.bldScopeRange;
    //
    this.turnRangeAmp = 1;
    //
    this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.enemySafetyZone = 81; // radius of each enemy planet and ship that will be avoided by us (planets in that range are not used as targets)
    // data container
    this.priorities = {
        bab: ["dur", "tri", "mol", "mcs"], // BAseBuilder
        stb: ["cla", "sup", "mcs"] // STructureBuilder
    };
    this.sources = [];
    this.constructionSites = [];
}
/*
    GENERAL REQUIRED METHODS
 */
builderAPS.prototype.handleCargo = function (aps) // called once on initialization and a second time with aps.confirmMission
{
    if (aps.planet && aps.isOwnPlanet)
    {
        var loaded = 0;
        if (aps.destination.id === aps.planet.id) // unload cargo when at destination
        {
            aps.unloadCargo();
            aps.unloadFuel();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id)
        {
            // we are at secondary destination
            var secDestCol = new Colony(aps.planet.id);
            if (aps.isSource(secDestCol))
            {
                loaded = this.loadCargo(aps); // load cargo
            }
        } else
        {
            var curC = new Colony(aps.planet.id);
            if (aps.isSource(curC))
            {
                loaded = this.loadCargo(aps); // load cargo
            }
        }
        //console.log("Cargo summary: " + transCargo);
    }
};
builderAPS.prototype.setDemand = function (aps, destination) // demand = what we need and don't have aboard
{
    if (typeof destination === "undefined") destination = aps.destination;
    aps.demand = []; // reset
    var dC = false;
    if (destination) dC = new Colony(destination.id);
    if (dC)
    {
        var obj = aps.moveables;
        var balance = dC.balance;
        this.priorities[aps.objectOfInterest].forEach(
            function (item, index) {
                if (balance[obj[item]] < 0)
                {
                    if (aps.ship[obj[item]] < (balance[obj[item]] * -1))
                    {
                        aps.demand.push( {
                            item: item,
                            value: (balance[obj[item]] *-1) - aps.ship[obj[item]]
                        } );
                    }
                }
            }
        );
    }
};
builderAPS.prototype.setPotentialDestinations = function(aps)
{
    // if current planet is former destination, check construction status
    if (aps.planet.id === aps.lastDestination.id)
    {
        this.setDemand(aps, aps.planet);
        if (aps.demand.length > 0)
        {
            console.log("Demand of last destination (" + aps.lastDestination.id + ") not yet satisfied...");
            this.constructionSites.push(new Colony(aps.planet.id));
        }
    }
    if (this.constructionSites.length === 0) {
        this.setConstructionSites(aps);
    }
    if (this.constructionSites.length < 1)
    {
        console.warn("[" + aps.ship.id + "] - no construction sites available!");
        aps.isIdle = true;
    } else {
        aps.potDest = this.constructionSites;
        aps.isIdle = false;
    }
    aps.updateStoredData();
};
builderAPS.prototype.setSecondaryDestination = function(aps)
{
    // make sure we took all we can get from current planet
    this.loadCargo(aps);
    // do we need a secondary destination?
    if (aps.getCargoCapacity() < 1) {
        if (aps.secondaryDestination) aps.secondaryDestination = false;
        return;
    }
    // check demand
    var dC = false;
    if (aps.destination) dC = new Colony(aps.destination.id);
    if (dC)
    {
        this.setDemand(aps, aps.destination);
        var demandStatus = aps.demand;
        console.log("...current status of demand >>");
        if (demandStatus.length > 0)
        {
            console.log(demandStatus);
            var potSource = this.getSource(aps, dC);
            if (potSource)
            {
                aps.secondaryDestination = vgap.getPlanet(potSource.planet.id);
                console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
            } else {
                // no secondary destination (sufficient source) found
                console.log("...couldn't find an adequate secondary destination.");
                aps.idle = true;
                if (aps.idleReason.indexOf("No source found") === -1) aps.idleReason.push("No source found");
            }
        } else
        {
            console.error("...we don't need anything, sir.");
            if (aps.secondaryDestination) aps.secondaryDestination = false;
            //aps.destination = false;
        }
    } else
    {
        console.error("We don't have a destination, sir. " + aps.destination.id + " - " + aps.base.id + " - " + aps.potDest[0].planet.id);
    }
};
builderAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
builderAPS.prototype.evaluateMissionDestinations = function(aps)
{
    var filteredDest = [];
    console.log("...filtering distributor destinations: " + aps.potDest.length);
    for (var i = 0; i < aps.potDest.length; i++)
    {
        if (aps.potDest[i].lR)
        {
            console.log("...adding last resort...");
            console.log(aps.potDest[i]);
            filteredDest.push(aps.potDest[i]);
            continue;
        }
        // in case another distributor is already serving the destination, exclude
        var conflictAPS = aps.destinationHasSameAPStype(aps.potDest[i].pid); // returns stored data for APS that also visit potPlanet with the same mission
        if (conflictAPS && !aps.potDest[i].lR)
        {
            console.log("...deficiency of planet " + aps.potDest[i].pid + " already a mission");
            continue;
        }
        filteredDest.push(aps.potDest[i]);
    }
    aps.potDest = filteredDest;
};
builderAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
    if (aps.destination && aps.objectOfInterest === "all")
    {
        var c = new Colony(aps.destination.id);
        var deficiencies = [];
        for (var i = 0; i < this.priorities.length; i++)
        {
            //var def = this.getObjectDeficiency(aps.destination, this.priorities[i]);
            var def = c.balance[aps.moveables[this.priorities[i]]];
            if (def < 0)
            {
                deficiencies.push( { ooi: this.priorities[i], deficiency: def } );
            }
        }
        if (deficiencies.length > 0)
        {
            if (deficiencies.length > 1)
            {
                deficiencies = autopilot.sortCollection(deficiencies, "deficiencies", "asc");
            }
            this.curOoi = deficiencies[0].ooi;
            aps.currentOoi = deficiencies[0].ooi;
            return true;
        }
    }
    return false;
};
builderAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    var conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    //console.log("Destination(" + potPlanet.id + ")HasSameAPStype: " + conflictAPS);
    if (conflictAPS)
    {
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        return true;
    }
};
/*
    REQUIRED MODULE METHODS
 */
builderAPS.prototype.loadCargo = function(aps) // never called when destination = planet
{
    if (aps.demand.length > 0)
    {
        var obj = aps.moveables;
        // transform aps.demand into [ { demand.item: demand.value } ]
        var demands = {
            duranium: 0,
            tritanium: 0,
            molybdenum: 0,
            clans: 0,
            supplies: 0,
            megacredits: 0
        };
        aps.demand.forEach(
            function (demand, index) {
                demands[obj[demand.item]] = demand.value;
            }
        );
        // check if megecredits are demanded
        if (demands.megacredits > 0)
        {
            // check if enough is available
            if (aps.planet.megacredits < demands.megacredits)
            {
                // check if supplies can be sold
                if (demands.supplies < aps.planet.supplies)
                {
                    var toBeSold = aps.planet.supplies - demands.supplies;
                    if (toBeSold > 0)
                    {
                        aps.sellSupply(false, toBeSold);
                    }
                }
            }
        }
        var loaded = 0;
        aps.demand.forEach(
            function (demand, index) {
                loaded += aps.loadObject(obj[demand.item], aps.planet, demand.value);
            }
        );
        this.setDemand(aps);
        return loaded;
    } else
    {
        return 0;
    }
};
builderAPS.prototype.setScopeRange = function(aps)
{
    if (this.scopeRange === "auto")
    {
        var inRange = aps.getAPSinRange(aps.scopeRange);
        if (inRange && inRange.length > 4)
        {
            aps.scopeRange *= 2;
        }
    } else
    {
        aps.scopeRange = this.scopeRange;
    }
};
builderAPS.prototype.getBasesToConstruct = function(aps)
{
    var potSites = [];
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var c = new Colony(vgap.myplanets[i].id);
        if (c.isBuildingBase)
        {
            this.setDemand(aps, c.planet);
            if (aps.demand.length > 0)
            {
                c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
                potSites.push(c);
            }
        }
    }
    return potSites;
};
builderAPS.prototype.getPlanetsToDevelop = function(aps)
{
    var potSites = [];
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var c = new Colony(vgap.myplanets[i].id);
        if (c.isBuildingStructures && c.getBuilderDemand(aps.objectOfInterest) < 0)
        {
            c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
            potSites.push(c);
        }
    }
    return potSites;
};
/*
    get source for construction site
 */
builderAPS.prototype.getSource = function(aps, site)
{
    var source = false;
    // check
    // a) between here and there (closer to site than current planet) and
    // b) within 2 turn dist of the site
    //
    var potColonies = [];
    var curDistTurns = Math.ceil(aps.getDistance(site.planet.x, site.planet.y, false) / Math.pow(aps.ship.engineid, 2));
    console.log("Distance (turns) to site: " + curDistTurns);
    if (aps.planet.id === site.planet.id)
    {
        // only b), since we are at the site
        var targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, (2 * Math.pow(aps.ship.engineid,2)));
        console.log("Found " + targetsInRange.length + " potential sources within " + (2 * Math.pow(aps.ship.engineid,2)) + " lj");
        console.log(targetsInRange);
        if (targetsInRange.length > 0)
        {
            targetsInRange.forEach(
                function (t, index) {
                    //console.log("Distance (turns) from this source (" + p.id + ") to site: " + src2siteDistTurns);
                    var curP = vgap.planetAt(t.x, t.y);
                    var curC = new Colony(curP.id);
                    curC.distance2APS = aps.getDistance(curC.planet.x, curC.planet.y);
                    if (aps.isSource(curC)) potColonies.push( curC );
                }
            );
        }
    } else
    {
        vgap.myplanets.forEach(
            function (p, index) {
                if (p.id === aps.planet.id) return; // skip current planet
                var src2siteDistTurns = Math.ceil(autopilot.getDistance( { x: p.x, y: p.y }, { x: site.planet.x, y: site.planet.y }, false ) / Math.pow(aps.ship.engineid, 2));
                console.log("Distance (turns) from this source (" + p.id + ") to site: " + src2siteDistTurns);
                var curC = new Colony(p.id);
                curC.distance2APS = aps.getDistance(curC.planet.x, curC.planet.y);
                if (curDistTurns > 2) // if we are further away than 2 turns, only use sources that are closer than current postion
                {
                    if (src2siteDistTurns < curDistTurns && aps.isSource(curC)) potColonies.push( curC );
                } else // else, also use sources that are located within the same turn distance as current postion
                {
                    if (src2siteDistTurns <= curDistTurns && aps.isSource(curC)) potColonies.push( curC );
                }
            }
        );
    }
    if (potColonies.length > 0)
    {
        if (potColonies.length > 0)
        {
            potColonies = autopilot.sortCollection(potColonies, "distance2APS", "asc");
        }
        return potColonies[0];
    }
    return source;
};
builderAPS.prototype.setConstructionSites = function(aps)
{
    this.setScopeRange(aps);
    var sites = [];
    if (aps.objectOfInterest === "bab")
    {
        sites = this.getBasesToConstruct(aps);
    } else if (aps.objectOfInterest === "stb")
    {
        sites = this.getPlanetsToDevelop(aps);
    }
    if (sites.length > 1)
    {
        sites = autopilot.sortCollection(sites, "distance2APS", "asc");
    }
    this.constructionSites = sites;
    console.warn("Construction Sites >>");
    console.log(this.constructionSites);
};
/*
    INTERNAL METHODS
 */
builderAPS.prototype.getPotentialSources = function(aps, sink, ooi)
{
    if (typeof sink === "undefined") // toDo: when is this the case?
    {
        sink = { pid: aps.planet.id, x: aps.planet.x, y: aps.planet.y, isFort: false, isBuilding: false, ooi: this.curOoi, deficiency: 100, resources: 1000 };
    }
    var potSources = [];
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var cCol = new Colony(vgap.myplanets[i].id);
        var excess = cCol.getDistributorCargo(ooi);
        if (excess > 0) potSources.push( cCol );
    }
    return potSources;
};
builderAPS.prototype.prioritizeSinks = function(aps, sinks)
{
    if (sinks.length > 1)
    {
        if (this.ooiPriority === "cla")
        {
            sinks = aps.getDevidedCollection(sinks, "government", 5, "eta", "asc");
        } else if (this.ooiPriority === "sup")
        {
            sinks = aps.getDevidedCollection(sinks, "resources", 4000, "eta", "asc");
        } else if (this.ooiPriority === "mcs")
        {
            sinks = aps.getDevidedCollection(sinks, "resources", 4000, "eta", "asc");
        } else
        {
            sinks = aps.getDevidedCollection(sinks, "eta", 2, "deficiency", "asc");
            //sinks = autopilot.sortCollection(sinks, "eta", "asc");
        }
    }
    return sinks;
};
builderAPS.prototype.addLastResortSink = function(aps, collection)
{
    if (collection.length > 0) // add one outside scope sink as last resort
    {
        // use the closest ooSSink to get the next ETA target and set that target as potential sink (regardless if it is a sink),
        // there, we will try again (set new destination)
        collection = autopilot.sortCollection(collection, "distance", "asc");
        // aps.setWaypoints(aps.ship, collection[0]);
        var lRplanet = vgap.getPlanet(collection[0].pid);
        var lR = aps.getEtaWaypoint(lRplanet);
        if (lR)
        {
            var lRdist = Math.floor(autopilot.getDistance({x: lR.x, y: lR.y}, {x:aps.ship.x ,y:aps.ship.y}));
            console.log("...last Resort Planet:");
            console.log(lR);
            this.sinks.push( { pid: lR.id, x: lR.x, y: lR.y, isFort: false, government: 0, deficiency: 0, distance: lRdist, lR: true } );
        }
    }
};
builderAPS.prototype.getObjectDeficiency = function(object, ooi)
{
    if (typeof ooi === "undefined") ooi = this.ooiPriority;
    if (this.curOoi) ooi = this.curOoi;
    if (ooi === "cla")
    {
        return autopilot.getClanDeficiency(object);
    } else if (ooi === "neu")
    {
        return autopilot.getFuelDeficiency(object);
    } else if (ooi === "sup")
    {
        return autopilot.getSupDeficiency(object);
    } else if (ooi === "mcs")
    {
        return autopilot.getMcDeficiency(object);
    }
    return false;
};
builderAPS.prototype.getCutOffBySinkDeficiency = function(planet)
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
builderAPS.prototype.getSpecificSources = function(aps)
{
    //var destDef = Math.floor(this.getObjectDeficiency(aps.destination) * 1.2);
    var needed = (destDef * -1) - aps.ship[aps.moveables[this.ooiPriority]];
    console.log("...needs " + this.ooiPriority + ": " + needed);
    var fSources = []; // filtered specific (satisfy deficiency) sources
    for (var i = 0; i < autopilot.frnnOwnPlanets.length; i++)
    {
        var cP = vgap.getPlanet(autopilot.frnnOwnPlanets[i].pid);
        if (cP.id === aps.destination.id) continue; // exclude destination
        var value = aps.getObjectExcess(cP);
        if ((value >= needed || value >= aps.maxCapacity) && !aps.planetIsSourceOfCollector(cP.id))
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
builderAPS.prototype.fillLoad = function (aps, sequence)
{
    var curCapacity = aps.getCurCapacity("clans"); // we start with clans, since they always should be part of a sequence
    var fuelReq = autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id);
    var fuelAva = aps.ship.neutronium + aps.planet.neutronium;
    var cargo = [
        aps.ship.duranium,
        aps.ship.tritanium,
        aps.ship.molybdenum,
        aps.ship.supplies,
        aps.ship.clans
    ];
    var trans = 0;
    var z = 0;
    while (curCapacity > 0 && z < 10)
    {
        for (var i = 0; i < sequence.length; i++)
        {
            var curObj = sequence[i].obj;
            var curDef = sequence[i].toLoad;
            if (curDef > 0)
            {
                var toLoad = curDef;
                console.log("...now loading: " + curObj + ": " + toLoad);
                cargo.push(toLoad);
                fuelReq = autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id, cargo);
                if (fuelAva < fuelReq) break;
                trans += aps.loadObject(curObj, aps.planet, toLoad);
            }
        }
        curCapacity = aps.getCurCapacity("clans"); // we keep updating cargo capacity
        z++;
    }
    return trans;
};
/*
 * Autopilot - Collector Module
 */
function collectorAPS()
{
    this.minimalCargoRatioToGo = autopilot.settings.colMinCapacity; // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.scopeRange = autopilot.settings.colScopeRange;
    this.sellSupply = true; // toDo: autopilot.settings.colSellsSupply
    this.turnRangeAmp = 1;
    this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.ooiPriority = "all"; // object of interest (ooi) priority: "all" (=dur, tri, mol), "dur", "tri", "mol", "mcs", "sup", "cla"
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
collectorAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
};
collectorAPS.prototype.setSinks = function(aps)
{
    // as collector, the base is always the sink
    if (this.ooiPriority === "all")
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
    if (this.scopeRange === "auto")
    {
        var inRange = aps.getAPSinRange(aps.scopeRange); // uses default of 100
        if (inRange && inRange.length > 5 || this.ooiPriority === "cla")
        {
            aps.scopeRange *= 3;
        } else if (inRange && inRange.length > 2)
        {
            aps.scopeRange *= 2;
        }
    } else
    {
        aps.scopeRange = this.scopeRange;
    }

};
collectorAPS.prototype.getGoodToGoSources = function(aps, potSources)
{
    var goodToGo = [];
    //var baseDef = autopilot.getBaseDeficiency(aps.base);
    var c = new Colony(aps.base.id);
    var baseDef = c.balance;
    //console.log(aps.objectOfInterest);
    if (c.isOwnPlanet)
    {
        for (var i = 0; i < potSources.length; i++)
        {
            // check if enough resources are there
            var tPlanet = vgap.planetAt(potSources[i].x, potSources[i].y);
            var sC = new Colony(tPlanet.id);
            var sB = sC.balance;
            var curETA = aps.getETA(tPlanet);
            var tValue = 0;
            if (this.isMineralCollector(aps))
            {
                if (!c.isFort && (baseDef.duranium < 0 || baseDef.tritanium < 0 || baseDef.molybdenum < 0))
                {
                    var defSat = 0;
                    if (baseDef.duranium > (sB.duranium * -1))
                    {
                        // dur deficiency can be satisfied
                        if (this.ooiPriority === "all" || this.ooiPriority === "dur") tValue += sB.duranium;
                        defSat++;
                    }
                    if (baseDef.tritanium > (sB.tritanium * -1))
                    {
                        // tri deficiency can be satisfied
                        if (this.ooiPriority === "all" || this.ooiPriority === "tri") tValue += sB.tritanium;
                        defSat++;
                    }
                    if (baseDef.molybdenum > (sB.molybdenum * -1))
                    {
                        // mol deficiency can be satisfied
                        if (this.ooiPriority === "all" || this.ooiPriority === "mol") tValue += sB.molybdenum;
                        defSat++;
                    }
                    if ((this.ooiPriority === "all" && defSat === 3) || tValue >= this.devideThresh)
                    {
                        potSources[i].mcs = tPlanet.megacredits;
                        potSources[i].value = tValue;
                        potSources[i].eta = curETA;
                        console.log("...add potential destination (baseDef).");
                        goodToGo.push(potSources[i]);
                        continue;
                    }
                }
                tValue = sC.getCollectorCargo(aps.objectOfInterest);
            } else
            {
                // neu, cla, sup, mcs
                tValue = sC.getCollectorCargo(aps.objectOfInterest); // toDo: use amount of arrival time!
            }
            if (tValue < this.devideThresh)
            {
                console.log("...removing destination " + tPlanet.id + " due to lack of objects (" + tValue + " / " + this.devideThresh + ")!");
                continue;
            }
            potSources[i].mcs = tPlanet.megacredits;
            potSources[i].value = tValue;
            potSources[i].eta = curETA;
            //console.log("...add potential destination.");
            goodToGo.push(potSources[i]);
        }
    }
    return goodToGo;
};
collectorAPS.prototype.getBalancedMineralValue = function(aps, res)
{
    var durTriBal = aps.base.duranium / aps.base.tritanium;
    var durMolBal = aps.base.duranium / aps.base.molybdenum;
    var triMolBal = aps.base.tritanium / aps.base.molybdenum;
    var newRes = res;

    // we define out of balance as the situation when there is 1.5 or more times as much of one mineral than the other
    if (durTriBal >= 1.5 || durTriBal <= 0.75)
    {
        if (durTriBal >= 1.5)
        {
            newRes.buildRes -= newRes.duranium;
            newRes.duranium = 0;
        } else {
            newRes.buildRes -= newRes.tritanium;
            newRes.tritanium = 0;
        }
    }
    if (durMolBal >= 1.5 || durMolBal <= 0.75)
    {
        if (durMolBal >= 1.5)
        {
            newRes.buildRes -= newRes.duranium;
        } else {
            newRes.buildRes -= newRes.molybdenum;
            newRes.molybdenum = 0;
        }
    }
    if (triMolBal >= 1.5 || triMolBal <= 0.75)
    {
        if (triMolBal >= 1.5)
        {
            newRes.buildRes -= newRes.tritanium;
        } else {
            newRes.buildRes -= newRes.molybdenum;
        }
    }
    //console.log("...balanced Value: " + newRes.buildRes);
    return newRes.buildRes;
};
collectorAPS.prototype.isMineralCollector = function(aps)
{
    return (aps.objectOfInterest === "all" || aps.objectOfInterest === "dur" || aps.objectOfInterest === "tri" || aps.objectOfInterest === "mol");
};
collectorAPS.prototype.setSources = function(aps)
{
    // toDo: decide which strategy to use
    //  -> scopeRange: the range for source selection is defined by how many collectors are active within a range of the base
    //  - fixedRange: the range is fixed for each base (e.g. 2-turn radius)
    this.setScopeRange(aps);
    var sortBy = "value";
    var c = new Colony(aps.base.id);
    if (c)
    {
        if (this.ooiPriority === "all")
        {
            //var baseDef = autopilot.getBaseDeficiency(aps.base);
            var baseDef = c.balance;
            if (!c.isFort && baseDef.duranium === 0 && baseDef.tritanium === 0 && baseDef.molybdenum === 0)
            {
                sortBy = "mcs";
            }
        } else if (this.ooiPriority === "cla")
        {
            //var baseMaxClans = autopilot.getMaxColonistPopulation(aps.base);
            var baseMaxClans = c.maxColPop;
            if (baseMaxClans - aps.base.clans <= 0)
            {
                aps.idle = true;
                if (aps.idleReason.indexOf("mission") === -1) aps.idleReason.push("mission");
                return;
            } // we do not need to collect more clans
        }
        var targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.scopeRange);
        console.log("... targets in range: " + targetsInRange.length);
        if (targetsInRange.length > 0)
        {
            targetsInRange = this.getGoodToGoSources(aps, targetsInRange);
        }
        console.log("... good-to-go targets: " + targetsInRange.length);
        var potential = [];
        for (var i = 0; i < targetsInRange.length; i++)
        {
            var tPlanet = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
            if (tPlanet)
            {
                //if (tPlanet.x == aps.ship.x && tPlanet.y == aps.ship.y) continue;
                //var tValue = aps.getObjectExcess(tPlanet);
                var distance = Math.ceil(autopilot.getDistance( {x: tPlanet.x, y: tPlanet.y}, {x:aps.ship.x ,y:aps.ship.y} ));
                //console.log("...ETA to " + tPlanet.id + " -> " + eta);
                potential.push( { x: tPlanet.x, y: tPlanet.y, pid: tPlanet.id, value: targetsInRange[i].value, mcs: targetsInRange[i].mcs, distance: distance, eta: targetsInRange[i].eta } );
            }
        }
        this.sources = aps.clusterSortCollection(potential, "eta", sortBy, "desc");
    }
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
        if (aps.potDest[i].pid !== aps.base.id)
        {
            var c = new Colony(aps.potDest[i].pid);
            var potPlanet = vgap.getPlanet(aps.potDest[i].pid);
            var potStarbase = vgap.getStarbase(potPlanet.id);
            if (potStarbase && this.isMineralCollector(aps) && !c.isFort)
            {
                console.log("...removing destination " + potPlanet.id + " as we do not collect from other bases with starbase");
                continue;
            }
            if (c && c.isBuildingBase) // don't use (other) prospected starbase planets
            {
                console.log("...removing destinations: " + potPlanet.id + " - a starbase will be built here!");
                continue;
            }
            var isHub = (potPlanet.note && potPlanet.note.body.match(/nup:hub/));
            // if potential destination is the base of another APS
            if (aps.isAPSbase(potPlanet.id))
            {
                // the base is employing APS of the same type (collector with priority x)
                if (aps.baseHasSameAPStype(potPlanet.id, "col", this.ooiPriority) && !isHub && !c.isFort)
                {
                    console.log("...removing destination " + potPlanet.id + " due to collector mission conflict");
                    continue;
                }
            }
        }
        filteredDest.push(aps.potDest[i]);
    }
    aps.potDest = filteredDest;
};
collectorAPS.prototype.handleCargo = function(aps) // called on arrival at destination and when at owned planet
{
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.atBase) // we are at base (sink)
        {
            if (!aps.isMakingTorpedoes()) aps.unloadCargo();
            if (this.ooiPriority === "neu") aps.unloadFuel();
        } else // source or waypoint
        {
            var transCargo = this.loadCargo(aps);
            console.log("Cargo load summary: " + transCargo);
        }
    }
};
collectorAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
collectorAPS.prototype.getLoadingSequence = function(aps)
{
    var bSequence = [];
    var lSequence = [];
    if (this.ooiPriority === "all")
    {
        bSequence = [ { res: "dur", value: parseInt(aps.base.duranium) }, { res: "tri", value: parseInt(aps.base.tritanium) }, { res: "mol", value: parseInt(aps.base.molybdenum) } ];
    } else if (this.ooiPriority === "dur")
    {
        lSequence = ["duranium"];
        bSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "tri", value: parseInt(aps.base.tritanium) } ];
    } else if (this.ooiPriority === "tri")
    {
        lSequence = ["tritanium"];
        bSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
    } else if (this.ooiPriority === "mol")
    {
        lSequence = ["molybdenum"];
        bSequence = [ { res: "tri", value: parseInt(aps.base.tritanium) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
    }
    // determine the (remaining) loading sequence by what is needed at base (sink)
    bSequence = autopilot.sortCollection(bSequence, "value", "asc");
    bSequence.forEach(function(seq){ lSequence.push(aps.moveables[seq.res]); });
    return lSequence;
};
collectorAPS.prototype.loadMinerals = function(aps)
{
    var curCargo = 0;
    var bC = new Colony(aps.base.id); // base colony
    var pC = new Colony(aps.planet.id); // source colony
    if (pC.isOwnPlanet)
    {
        if (bC.isBuildingBase) // load what's needed to build the base
        {
            if (bC.balance.duranium < 0 || bC.balance.tritanium < 0 || bC.balance.molybdenum < 0)
            {
                var lSeq = ["duranium", "tritanium", "molybdenum"];
                for (var i = 0; i < lSeq.length; i++)
                {
                    if (bC.balance[lSeq[i]] < 0) curCargo += aps.loadObject(lSeq[i], aps.planet, (bC.balance[lSeq[i]]*-1));
                }
            }
        }
        //
        // check which minerals to prioritize...
        var loadingSequence = this.getLoadingSequence(aps);
        // load in sequence
        for (var j = 0; j < loadingSequence.length; j++)
        {
            curCargo += aps.loadObject(loadingSequence[j], aps.planet);
        }
    } else
    {
        console.error("Colony does not exist: " + aps.base.id + " " + aps.planet.id);
    }
    return curCargo;
};
collectorAPS.prototype.loadCargo = function(aps) // not called at BASE
{
    var loaded = 0;
    // mineral handling
    if (this.isMineralCollector(aps))
    {
        console.log("...loading minerals...");
        loaded = this.loadMinerals(aps);
    } else
    {
        console.log("...loading other stuff...");
        loaded = aps.loadObject(aps.moveables[aps.objectOfInterest], aps.planet);
    }

    // we generally collect megacredits if option is active
    if (this.alwaysLoadMC)
    {
        // are we transforming supplies to MCs first?
        if (this.sellSupply)
        {
            aps.sellSupply();
        }
        loaded += aps.loadObject("megacredits", aps.planet);
    }
    return loaded;
};/*
 *
 * Autopilot - Distributor Module
 *      - destination is always a sink
 *      - if current planet or ship does not hold the required resources, a secondary destination is selected and approached first
 *      - will approach sink, if cargo holds sufficient material
 */
function distributorAPS()
{
    this.minimalCargoRatioToGo = autopilot.settings.disMinCapacity; // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.scopeRange = autopilot.settings.disScopeRange;
    this.turnRangeAmp = 1;
    this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.priorities = ["cla", "sup", "mcs", "neu", "dur", "tri", "mol"];
    this.minerals = ["duranium", "tritanium", "molybdenum"];
    this.ooiPriority = "cla"; // object of interest (ooi) priority "all" = cla, sup, mcs, neu, default cla
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
    var potSinks = [];
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var c = new Colony(vgap.myplanets[i].id);
        if (c.isSink)
        {
            if (aps.objectOfInterest !== "all")
            {
                if (aps.objectOfInterest === "neu" && c.isFuelSink) potSinks.push(c);
                if (aps.objectOfInterest === "cla" && c.isColonistSink) potSinks.push(c);
                if ((aps.objectOfInterest === "sup" || aps.objectOfInterest === "mcs") && c.isStructureSink) potSinks.push(c);
            } else
            {
                if (c.isMineralSink || c.isColonistSink || c.isStructureSink) potSinks.push(c);
            }
        }
    }
    return potSinks;
};
distributorAPS.prototype.getSinksWithNatives = function(aps)
{
    var swn = [];
    var cutOff = -50;
    var minResolveFactor = 0.5;
    var potSinks = this.getPotentialSinks(aps);
    for (var i = 0; i < potSinks.length; i++)
    {
        if (potSinks[i].government)
        {
            var sinkPlanet = vgap.getPlanet(potSinks[i].pid);
            var distance = Math.floor( autopilot.getDistance( { x: sinkPlanet.x, y: sinkPlanet.y }, { x: aps.ship.x, y: aps.ship.y } ));
            //var def = this.getObjectDeficiency(sinkPlanet);
            potSinks[i].deficiency = def;
            potSinks[i].distance = distance;
            potSinks[i].isFort = autopilot.colony[sinkPlanet.id].isFort;
            potSinks[i].lR = false; // last resort
            if (distance <= aps.scopeRange && def < cutOff && aps.maxCapacity >= (def * -minResolveFactor)) swn.push(potSinks[i]);
        }
    }
    return swn;
};
distributorAPS.prototype.classifySinks = function(aps)
{
    var classified = [];
    var potSinks = this.getPotentialSinks(aps); // colonies
    if (potSinks.length > 0)
    {
        console.log("POTENTIAL SINKS FOUND >> " + potSinks.length);
        //console.log(potSinks);

        for (var i = 0; i < potSinks.length; i++)
        {
            var potSource = this.getSource4Sink(aps, potSinks[i], true);
            if (potSource)
            {
                var scopeDist = potSinks[i].getDistance(aps.ship);
                //var sourceDist = potSource.getDistance(aps.ship);

                if (scopeDist > aps.scopeRange && !potSinks[i].isBuilding) // outside of scope range, unless colony is building a starbase => ignore scope distance
                {
                    classified.push( { potSink: potSinks[i], class: "ooscope", dist: scopeDist} );
                } else if (aps.objectOfInterest === "all" && potSinks[i].mineralRequest < aps.minCapacity)
                {
                    classified.push( { potSink: potSinks[i], class: "ooresolve", dist: scopeDist} );
                } else {
                    if (potSinks[i].planet.nativegovernment)
                    {
                        classified.push( { potSink: potSinks[i], class: "goodnatives", dist: scopeDist} );
                    } else {
                        classified.push( { potSink: potSinks[i], class: "goodplain", dist: scopeDist} );
                    }
                }
            } else
            {
                console.log("Couldn't find source for sink " + potSinks[i].planet.id);
            }
        }
    } else
    {
        console.warn("NO POTENTIAL SINKS FOUND!");
    }
    return classified;
};
distributorAPS.prototype.getSource4Sink = function(aps, sink, includeCurPlanet)
{
    // get adequate source closest to sink
    //
    if (sink.isSink)
    {
        var ooi;
        if (aps.objectOfInterest === "all")
        {
            if (sink.isStructureSink) ooi = "sup";
            if (sink.isColonistSink) ooi = "cla";
            if (sink.isFuelSink) ooi = "neu";
        } else
        {
            ooi = aps.objectOfInterest;
        }

        if (ooi)
        {
            var needed = (sink.balance[aps.moveables[ooi]] * -1) - aps.ship[aps.moveables[ooi]];
            if (needed > aps.curCapacity) needed = aps.curCapacity;

            var potSources = this.getPotentialSources(aps, sink, ooi);
            console.log("> Potential sources:");
            console.log(potSources);
            var pSpool = [];
            for (var i = 0; i < potSources.length; i++)
            {
                var cC = potSources[i];
                if (aps.planet.id === cC.planet.id && !includeCurPlanet) continue; // exclude the current planet,
                var pSexcess = potSources[i].getDistributorCargo(ooi);
                if (pSexcess >= needed)
                {
                    // calculate distance to travel from current position
                    potSources[i].jDist = Math.floor(
                        autopilot.getDistance( { x: cC.planet.x, y: cC.planet.y }, { x: sink.planet.x, y: sink.planet.y } ) +
                        autopilot.getDistance( { x: cC.planet.x, y: cC.planet.y }, { x: aps.ship.x, y: aps.ship.y } )
                    );
                    potSources[i].jEta = Math.ceil(potSources[i].jDist / Math.pow(aps.ship.engineid, 2));
                    pSpool.push(potSources[i]);
                }
            }
            if (pSpool.length > 0)
            {
                if (pSpool.length > 1)
                {
                    pSpool = autopilot.sortCollection(pSpool, "jDist");
                }
                //console.log(pSpool);
                return pSpool[0];
            }
        }
    }
    return false;
};
distributorAPS.prototype.getPotentialSources = function(aps, sink, ooi)
{
    if (typeof sink === "undefined") // toDo: when is this the case?
    {
        sink = { pid: aps.planet.id, x: aps.planet.x, y: aps.planet.y, isFort: false, isBuilding: false, ooi: this.curOoi, deficiency: 100, resources: 1000 };
    }
    var potSources = [];
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var cCol = new Colony(vgap.myplanets[i].id);
        var excess = cCol.getDistributorCargo(ooi);
        if (excess > 0) potSources.push( cCol );
    }
    return potSources;
};
distributorAPS.prototype.prioritizeSinks = function(aps, sinks)
{
    if (sinks.length > 1)
    {
        if (this.ooiPriority === "cla")
        {
            sinks = aps.getDevidedCollection(sinks, "government", 5, "eta", "asc");
        } else if (this.ooiPriority === "sup")
        {
            sinks = aps.getDevidedCollection(sinks, "resources", 4000, "eta", "asc");
        } else if (this.ooiPriority === "mcs")
        {
            sinks = aps.getDevidedCollection(sinks, "resources", 4000, "eta", "asc");
        } else
        {
            sinks = aps.getDevidedCollection(sinks, "eta", 2, "deficiency", "asc");
            //sinks = autopilot.sortCollection(sinks, "eta", "asc");
        }
    }
    return sinks;
};
distributorAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
    if (aps.destination && aps.objectOfInterest === "all")
    {
        var c = new Colony(aps.destination.id);
        var deficiencies = [];
        for (var i = 0; i < this.priorities.length; i++)
        {
            //var def = this.getObjectDeficiency(aps.destination, this.priorities[i]);
            var def = c.balance[aps.moveables[this.priorities[i]]];
            if (def < 0)
            {
                deficiencies.push( { ooi: this.priorities[i], deficiency: def } );
            }
        }
        if (deficiencies.length > 0)
        {
            if (deficiencies.length > 1)
            {
                deficiencies = autopilot.sortCollection(deficiencies, "deficiencies", "asc");
            }
            this.curOoi = deficiencies[0].ooi;
            aps.currentOoi = deficiencies[0].ooi;
            return true;
        }
    }
    return false;
};
distributorAPS.prototype.setSinks = function(aps)
{
    this.setScopeRange(aps);
    var potSinks = this.classifySinks(aps);
    if (potSinks.length < 1)
    {
        if (aps.objectOfInterest === "all")
        {
            aps.objectOfInterest = "sup"; // since "all" means "cla" during potentialSink determination
            potSinks = this.classifySinks(aps);
            // toDo: save new ooi if potSinks.length > 0
        }
    }  else
    {
        console.log("CLASSIFIED SINKS >> " + potSinks.length);
        //console.log(potSinks);
    }
    var trueSinks = []; // best fit sinks
    var backupSinks = []; // outside of minimalCargoRatioToGo or - in case of ooi = cla - without natives
    var ooSSinks = [];  // outside of scope range

    for (var i = 0; i < potSinks.length; i++)
    {
        var curPotSink = potSinks[i].potSink;
        curPotSink.pid = potSinks[i].potSink.planet.id;
        curPotSink.x = potSinks[i].potSink.planet.x;
        curPotSink.y = potSinks[i].potSink.planet.y;
        curPotSink.eta = Math.ceil(potSinks[i].dist / Math.pow(aps.ship.engineid, 2));
        curPotSink.government = potSinks[i].potSink.planet.nativegovernment;
        curPotSink.resources = potSinks[i].potSink.getSumOfAllMinerals();
        if (potSinks[i].class === "ooscope")
        {
            ooSSinks.push(potSinks[i].potSink);
        } else if (potSinks[i].class === "goodplain" || potSinks[i].class === "goodnatives")
        {
            if (this.ooiPriority === "cla" && potSinks[i].class === "goodnatives")
            {
                trueSinks.push(potSinks[i].potSink);
            } else
            {
                backupSinks.push(potSinks[i].potSink);
            }
        }  else if (potSinks[i].class === "ooresolve")
        {
            backupSinks.push(potSinks[i].potSink);
        } else
        {
            // skipping cutoff sinks
        }
    }
    if (trueSinks.length > 1) trueSinks = this.prioritizeSinks(aps, trueSinks);
    if (backupSinks.length > 1) backupSinks = this.prioritizeSinks(aps, backupSinks);

    if (trueSinks.length > 0 && backupSinks.length > 0)
    {
        this.sinks = trueSinks.concat(backupSinks);
    } else if (trueSinks.length > 0)
    {
        this.sinks = trueSinks;
    } else if (backupSinks.length > 0)
    {
        this.sinks = backupSinks;
    }
    this.addLastResortSink(aps, ooSSinks);
    console.warn("FINAL SINKS >>");
    console.log(this.sinks);
};
distributorAPS.prototype.addLastResortSink = function(aps, collection)
{
    if (collection.length > 0) // add one outside scope sink as last resort
    {
        // use the closest ooSSink to get the next ETA target and set that target as potential sink (regardless if it is a sink),
        // there, we will try again (set new destination)
        collection = autopilot.sortCollection(collection, "distance", "asc");
        // aps.setWaypoints(aps.ship, collection[0]);
        var lRplanet = vgap.getPlanet(collection[0].pid);
        var lR = aps.getEtaWaypoint(lRplanet);
        if (lR)
        {
            var lRdist = Math.floor(autopilot.getDistance({x: lR.x, y: lR.y}, {x:aps.ship.x ,y:aps.ship.y}));
            console.log("...last Resort Planet:");
            console.log(lR);
            this.sinks.push( { pid: lR.id, x: lR.x, y: lR.y, isFort: false, government: 0, deficiency: 0, distance: lRdist, lR: true } );
        }
    }
};
distributorAPS.prototype.setScopeRange = function(aps)
{
    if (this.scopeRange === "auto")
    {
        var inRange = aps.getAPSinRange(aps.scopeRange);
        if (inRange && inRange.length > 4)
        {
            aps.scopeRange *= 2;
        }
    } else
    {
        aps.scopeRange = this.scopeRange;
    }
};
distributorAPS.prototype.getObjectDeficiency = function(object, ooi)
{
    if (typeof ooi === "undefined") ooi = this.ooiPriority;
    if (this.curOoi) ooi = this.curOoi;
    if (ooi === "cla")
    {
        return autopilot.getClanDeficiency(object);
    } else if (ooi === "neu")
    {
        return autopilot.getFuelDeficiency(object);
    } else if (ooi === "sup")
    {
        return autopilot.getSupDeficiency(object);
    } else if (ooi === "mcs")
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
distributorAPS.prototype.isSource = function(aps)
{
    // has the current planet (=not primary or secondary destination) something to offer for
    // a) the primary destination
    // or
    // b) the next target
    var cC = new Colony(aps.planet.id); // current colony
    if (cC.isOwnPlanet)
    {
        // a)
        var dC = new Colony(aps.destination.id); // destination colony
        if ((dC.balance.clans < 0 && cC.balance.clans > 0) ||
            (dC.balance.supplies < 0 && cC.balance.supplies > 0) ||
            (dC.balance.megacredits < 0 && cC.balance.megacredits > 0) ||
            (dC.balance.duranium < 0 && cC.balance.duranium > 0) ||
            (dC.balance.tritanium < 0 && cC.balance.tritanium > 0) ||
            (dC.balance.molybdenum < 0 && cC.balance.molybdenum > 0) ||
            (dC.balance.neutronium < 0 && cC.balance.neutronium > 0)
        ) return true;
        // b)
        if (aps.targetIsSet())
        {
            var tP = vgap.planetAt(aps.ship.targetx, aps.ship.targety); // target colony
            if (tP && tP.isOwnPlanet)
            {
                var tC = new Colony(tP.id);
                if ((tP.balance.clans < 0 && cC.balance.clans > 0) ||
                    (tP.balance.supplies < 0 && cC.balance.supplies > 0) ||
                    (tP.balance.megacredits < 0 && cC.balance.megacredits > 0) ||
                    (tP.balance.duranium < 0 && cC.balance.duranium > 0) ||
                    (tP.balance.tritanium < 0 && cC.balance.tritanium > 0) ||
                    (tP.balance.molybdenum < 0 && cC.balance.molybdenum > 0)
                ) return true;
            }
        }
    }
    return false;
};
distributorAPS.prototype.getSpecificSources = function(aps)
{
    //var destDef = Math.floor(this.getObjectDeficiency(aps.destination) * 1.2);
    var needed = (destDef * -1) - aps.ship[aps.moveables[this.ooiPriority]];
    console.log("...needs " + this.ooiPriority + ": " + needed);
    var fSources = []; // filtered specific (satisfy deficiency) sources
    for (var i = 0; i < autopilot.frnnOwnPlanets.length; i++)
    {
        var cP = vgap.getPlanet(autopilot.frnnOwnPlanets[i].pid);
        if (cP.id === aps.destination.id) continue; // exclude destination
        var value = aps.getObjectExcess(cP);
        if ((value >= needed || value >= aps.maxCapacity) && !aps.planetIsSourceOfCollector(cP.id))
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
distributorAPS.prototype.getPotDestNull = function(aps)
{
    if (typeof aps.potDest[0] === "undefined" && aps.destination)
    {
        var def = 0;
        var c = new Colony(aps.destination.id);
        if (aps.objectOfInterest !== "all")
        {
            //var defi = this.getObjectDeficiency(aps.destination, aps.objectOfInterest);
            def = c[aps.destination.id].balance[aps.moveables[aps.objectOfInterest]];
            if (def < 0)
            {
                return {
                    pid:        aps.destination.id,
                    x:          aps.destination.x,
                    y:          aps.destination.y,
                    isFort:     false,
                    lR:         false,
                    distance:   0,
                    eta:        0,
                    class:      0,
                    ooi:        aps.objectOfInterest,
                    deficiency: def
                };
            }
        } else {
            this.setCurrentOoi(aps);
            if (this.curOoi)
            {
                def = c[aps.destination.id].balance[aps.moveables[this.curOoi]];
                return {
                    pid:        aps.destination.id,
                    x:          aps.destination.x,
                    y:          aps.destination.y,
                    isFort:     false,
                    lR:         false,
                    distance:   0,
                    eta:        0,
                    class:      0,
                    ooi:        deficiencies[0].ooi,
                    deficiency: deficiencies[0].deficiency
                };
            }
            var deficiencies = [];
            for (var i = 0; i < this.priorities.length; i++)
            {
                //var def = this.getObjectDeficiency(aps.destination, this.priorities[i]);
                var def = c[aps.destination.id].balance[aps.moveables[this.priorities[i]]];
                if (def < 0)
                {
                    deficiencies.push( { ooi: this.priorities[i], deficiency: def } );
                }
            }
            if (deficiencies.length > 0)
            {
                if (deficiencies.length > 1)
                {
                    deficiencies = autopilot.sortCollection(deficiencies, "deficiency", "asc");
                }
                return {
                    pid:        aps.destination.id,
                    x:          aps.destination.x,
                    y:          aps.destination.y,
                    isFort:     false,
                    lR:         false,
                    distance:   0,
                    eta:        0,
                    class:      0,
                    ooi:        deficiencies[0].ooi,
                    deficiency: deficiencies[0].deficiency
                };
            }
        }
    }
    return false;
};
distributorAPS.prototype.setSecondaryDestination = function(aps)
{
    // do we need a secondary destination?
    // check if ship cargo or planet contains the required amount for sink (destination)
    var dC = false;
    if (aps.destination) {
        dC = new Colony(aps.destination.id);
    } else {
        if (aps.potDest.length === 0)
        {
            dC = new Colony(aps.base.id);
        } else
        {
            dC = new Colony(aps.potDest[0].pid);
        }
    }
    if (dC)
    {
        var ooiP = this.ooiPriority;
        var curObj = aps.moveables[ooiP];
        if (this.setCurrentOoi(aps))
        {
            ooiP = this.curOoi;
            curObj = aps.moveables[this.curOoi];
        }

        var cC = new Colony(aps.planet.id);
        var deficiency = dC.balance[curObj] *-1;
        console.log("...primary deficiency = " + deficiency + " " + ooiP);
        if (deficiency > 0)
        {
            if (deficiency > aps.getCurCapacity(curObj)) deficiency = aps.getCurCapacity(curObj);
            if (aps.ship[curObj] < deficiency && (aps.ship[curObj] + cC.balance[curObj]) < deficiency) // we are at the sink, our primary destination
            {
                console.log("...need to get more stuff somewhere else!");
                var potSource = this.getSource4Sink(aps, dC);
                if (potSource)
                {
                    aps.secondaryDestination = vgap.getPlanet(potSource.pid);
                    console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
                } else {
                    // no secondary destination (sufficient source) found
                    console.log("...couldn't find an adequate secondary destination.");
                    // get the next ETA waypoint
                    var nextWaypoint = false;
                    if (aps.planet.id !== aps.destination.id)
                    {
                        nextWaypoint = aps.getEtaWaypoint(aps.destination);
                    } else if (aps.planet.id !== aps.base.id)
                    {
                        nextWaypoint = aps.getEtaWaypoint(aps.base);
                    }
                    if (nextWaypoint)
                    {
                        aps.secondaryDestination = nextWaypoint.planet;
                    } else {
                        aps.secondaryDestination = aps.base;
                        var closestplanet = autopilot.getClosestPlanet(aps.ship, 0, false);
                        if (closestplanet) aps.secondaryDestination = closestplanet;
                    }
                }
            }
        }
    } else
    {
        console.error("Colony does not exist: " + aps.destination.id + " - " + aps.base.id + " - " + aps.potDest[0].pid);
    }
};
distributorAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
distributorAPS.prototype.setPotentialDestinations = function(aps)
{
    if (this.sinks.length === 0) {
        this.setSinks(aps);
    }
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
        if (aps.potDest[i].lR)
        {
            console.log("...adding last resort...");
            console.log(aps.potDest[i]);
            filteredDest.push(aps.potDest[i]);
            continue;
        }
        // in case another distributor is already serving the destination, exclude
        var conflictAPS = aps.destinationHasSameAPStype(aps.potDest[i].pid); // returns stored data for APS that also visit potPlanet with the same mission
        if (conflictAPS && !aps.potDest[i].lR)
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
    var ooi = this.ooiPriority;
    if (this.curOoi) ooi = this.curOoi;
    if (ooi === "neu") // test with fuel only
    {
        // is there another distributor on its way, to satisfy the deficiency?
        if (!aps.planetIsSinkOfDistributor(aps.planet.id, ooi))
        {
            //var localDef = this.getObjectDeficiency(aps.planet, ooi) * -1;
            var c = new Colony(aps.planet.id);
            if (!c.isOwnPlanet) return;
            var localDef = c.balance[aps.moveables[ooi]];
            //console.log("...local deficiency (" + this.ooiPriority + "):" + localDef);
            if (localDef < 0)
            {
                aps.unloadObject(aps.moveables[ooi], aps.planet, localDef);
            }
        }
    }
};
distributorAPS.prototype.handleCargo = function (aps) // called once on initialization and a second time with aps.confirmMission
{
    if (aps.planet && aps.isOwnPlanet)
    {
        var transCargo = 0;
        if (aps.destination.id === aps.planet.id) // unload cargo when at destination
        {
            aps.unloadCargo();
            aps.unloadFuel();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id)
        {
            // we are at secondary destination
            aps.unloadCargo();
            if (this.setCurrentOoi(aps) || this.ooiPriority !== "all")
            {
                transCargo = this.loadCargo(aps); // load cargo
            } else
            {
                // new destination necessary, set current planet as destination
                aps.destination = aps.planet;
            }
        } else
        {
            // we are somewhere else... is it a potential source or the last destination (confirm Mission called again)
            if (this.isSource(aps) || (aps.lastDestination && aps.lastDestination.id === aps.planet.id))
            {
                aps.unloadCargo();
                console.log("..current Planet has Source potential? " + this.isSource(aps));
                transCargo = this.loadCargo(aps); // load cargo
            }
            // this.satisfyLocalDeficiency(aps); // toDo: not sure if this should be active, turned off for now
        }
        //console.log("Cargo summary: " + transCargo);
    }
};
distributorAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
distributorAPS.prototype.fillLoad = function (aps, sequence)
{
    var curCapacity = aps.getCurCapacity("clans"); // we start with clans, since they always should be part of a sequence
    var fuelReq = autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id);
    var fuelAva = aps.ship.neutronium + aps.planet.neutronium;
    var cargo = [
        aps.ship.duranium,
        aps.ship.tritanium,
        aps.ship.molybdenum,
        aps.ship.supplies,
        aps.ship.clans
    ];
    var trans = 0;
    var z = 0;
    while (curCapacity > 0 && z < 10)
    {
        for (var i = 0; i < sequence.length; i++)
        {
            var curObj = sequence[i].obj;
            var curDef = sequence[i].toLoad;
            if (curDef > 0)
            {
                var toLoad = curDef;
                console.log("...now loading: " + curObj + ": " + toLoad);
                cargo.push(toLoad);
                fuelReq = autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id, cargo);
                if (fuelAva < fuelReq) break;
                trans += aps.loadObject(curObj, aps.planet, toLoad);
            }
        }
        curCapacity = aps.getCurCapacity("clans"); // we keep updating cargo capacity
        z++;
    }
    return trans;
};
distributorAPS.prototype.loadCargo = function(aps) // never called when destination = planet
{
    // toDo: don't take any cargo with you if you are flying to a secondary destination which is further away from primary destination than the current planet!
    //console.log("...loadCargo...");
    var transCargo = 0;
    //
    // load destination colony balance of ALL or SPECIFIC
    //
    var cpC = new Colony(aps.planet.id); // Colony @ current position
    var dpC = new Colony(aps.destination.id); // Colony @ destination
    var ooi = this.ooiPriority;
    if (ooi === "all")
    {
        // bring as much of everything (cla, sup, mcs) as possible
        var defCol = [];
        for (var i = 0; i < 3; i++)
        {
            var curObj = aps.moveables[this.priorities[i]];
            var curDef = Math.floor(dpC.balance[curObj])*-1;
            var curExc = Math.floor(cpC.balance[curObj]);
            if (curDef > 0 && curExc > 0 && aps.ship[curObj] < curDef)
            {
                var toLoad = curDef - aps.ship[curObj];
                if (toLoad > curExc) toLoad = curExc;
                console.log("...add to sequence: " + curObj + ": " + toLoad);
                defCol.push( { obj: curObj, toLoad: toLoad } );
            }
        }
        transCargo += this.fillLoad(aps, defCol);
    } else
    {
        var thisObj = aps.moveables[ooi];
        // bring 3 times as much of SPECIFIC, if possible
        var deficiency = Math.floor(dpC.balance[thisObj]);
        if (deficiency < 0)
        {
            var maxLoad = 0;
            var specificLoad = deficiency * -3;
            console.log("...loading max. 3-times deficiency (" + specificLoad + " " + (deficiency * -3) + ") with " + thisObj);
            transCargo = aps.loadObject(thisObj, aps.planet, specificLoad);

            // Also bring money if necessary and available
            var mcDef = dpC.balance.megacredits;
            if (mcDef < 0)
            {
                var mcLoad = mcDef * -3;
                console.log("...loading remaining capacity (" + mcLoad + ") with megacredits");
                transCargo = aps.loadObject("megacredits", aps.planet, mcLoad);
            }
        } else
        {
            // there is no deficiency
            console.log("...primary deficiency = 0");
        }
    }
    console.log("Standard transfer summary: " + transCargo);
    // ALWAYS
    // - try to satisfy mineral deficiency of target planet
    if (aps.targetIsSet() && aps.getCargoCapacity() > 10)
    {
        var tp = vgap.planetAt(aps.ship.targetx, aps.ship.targety); // target planet
        if (tp)
        {
            var tc = new Colony(tp.id); // target colony, sink
            var cc = new Colony(aps.planet.id); // current colony, sourcse
            if (tc.isOwnPlanet)
            {
                if ((tc.balance.duranium < 0 && cc.balance.duranium > 0) ||
                    (tc.balance.tritanium < 0 && cc.balance.tritanium > 0) ||
                    (tc.balance.molybdenum < 0 && cc.balance.molybdenum > 0))
                {
                    var s = aps.ship;
                    var cargo = [s.clans, s.supplies];
                    var remainingCap = aps.getCargoCapacity();
                    for (var j = 0; j < this.minerals.length; j++)
                    {
                        if (tc.balance[this.minerals[j]] < 0 && cc.balance[this.minerals[j]] > 0 && remainingCap > 0)
                        {
                            var simLoad = tc.balance[this.minerals[j]]*-1;
                            if (simLoad > remainingCap) simLoad = remainingCap;
                            if (simLoad > cc.balance[this.minerals[j]]) simLoad = cc.balance[this.minerals[j]];

                            remainingCap -= simLoad;
                            cargo.push(simLoad);
                        }
                    }
                    // check if enough fuel is available for increased load
                    var additionalConsumption = autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id, cargo) - autopilot.getOptimalFuelConsumptionEstimate(aps.ship.id);
                    if (additionalConsumption <= cc.planet.neutronium)
                    {
                        var addCargo = 0;
                        for (var k = 0; k < this.minerals.length; k++)
                        {
                            if (tc.balance[this.minerals[k]] < 0 && cc.balance[this.minerals[k]] > 0)
                            {
                                var load = tc.balance[this.minerals[k]]*-1;
                                console.log("...satisfying next target's deficiency of " + this.minerals[k] + ": " + load);
                                addCargo += aps.loadObject(this.minerals[k], aps.planet, load);
                            }
                        }
                        console.log("...extra load: " + addCargo);
                    } else
                    {
                        console.log("...additional fuel consumption (" + additionalConsumption + ") to high!");
                    }
                }
            }
        }
    }
    return transCargo + addCargo;
};/*
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
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
    this.expanderKit = false;
}
expanderAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
};
expanderAPS.prototype.getOtherColonizer = function(p)
{
    /*
     *   Very early check if
     *   a) there is an expander on-site
     *   b) another expander is colonizing this site
     */
    var hasColonizer = false;
    var onSite = autopilot.getAPSatPlanet(p);
    if (onSite.length > 0)
    {
        for (var i = 0; i < onSite.length; i++)
        {
            if (onSite[i].shipFunction === "exp")
            {
                hasColonizer = onSite[i];
                break;
            }
        }
    }
    if (hasColonizer) return hasColonizer;
    //
    var approaching = autopilot.getAPSwithDestination(p);
    //console.log(approaching);
    if (approaching.length > 0)
    {
        for (var j = 0; j < approaching.length; j++)
        {
            if (approaching[j].shipFunction === "exp")
            {
                hasColonizer = approaching[j];
                break;
            }
        }
    }
    return hasColonizer;
};
expanderAPS.prototype.setSinks = function(aps)
{
    // as expander, each unowned planet is a sink
    // and the object of interest will always be clans
    // however, if it would be known that there are natives (bioscan) priority could be used for those planets
    // the same goes for planets where the resources are known
    this.setScopeRange(aps);
    var targetsInRange = aps.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    console.log("...targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
    var withNatives = [];
    var amorph = [];
    var potential = [];
    for (var i = 0; i < targetsInRange.length; i++)
    {
        var sP = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
        if (sP)
        {
            // distance to sinkPlanet
            var distance = Math.floor(autopilot.getDistance({x: sP.x, y: sP.y}, {x:aps.ship.x ,y:aps.ship.y}));

            //
            var hasColonizer = this.getOtherColonizer(sP);
            if (hasColonizer)
            {
                // check if current APS is closer (in eta) to target
                var otherAps = vgap.getShip(hasColonizer.sid);
                var thisMaxTurnDist = Math.pow(aps.ship.warp,2);
                var thisEta = 1 + Math.floor(distance / thisMaxTurnDist);
                var otherMaxTurnDist = Math.pow(otherAps.warp,2);
                var otherEta = 1 + Math.floor(Math.floor(autopilot.getDistance({x: sP.x, y: sP.y}, {x:otherAps.x ,y:otherAps.y})) / otherMaxTurnDist);

                if (otherEta <= thisEta)
                {
                    console.log("...planet " + sP.id + " will be colonized by APS " + hasColonizer.sid);
                    continue;
                } else
                {
                    console.log("...we are closer to planet " + sP.id + " than APS " + hasColonizer.sid);
                    // now what?
                    if (!hasColonizer.secondaryDestination)
                    {
                        hasColonizer.destination = false;
                        autopilot.setupAPS(hasColonizer.sid, hasColonizer);
                        //aps.storedData = autopilot.syncLocalStorage(hasColonizer);
                    }
                }
            }


            var deficiency = 150;
            // this.frnnSinks.push({x: sP.x, y: sP.y}); // redundant?
            //console.log("...distance: " + distance + " / range: " + Math.pow(aps.hull.engineid, 2));
            if (sP.nativeclans > 0 && sP.nativeracename === "Amorphous")
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
            // only if slow colonization is the mission
            if (aps.objectOfInterest === "slw") potential = potential.concat(amorph);
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
    if (inRange && inRange.length > 3)
    {
        aps.scopeRange *= 3;
    } else
    {
        aps.scopeRange *= 2;
    }
};
expanderAPS.prototype.setSources = function(aps)
{
    var goodSources = [];
    var expanderCargo = this.getExpanderKit(aps, true);
    for (var i = 0; i < vgap.myplanets.length; i++)
    {
        var c = new Colony(vgap.myplanets[i].id);
        // we only look for sources, if the aps.planet does not offer anything, so we can exclude this colony (c) as potential source
        if (c.isOwnPlanet && aps.planet.id !== c.planet.id)
        {
            var clans = c.balance.clans;
            var supplies = c.balance.supplies;
            var mcs = c.balance.megacredits;

            if ( (clans >= (expanderCargo.cla * this.minimalCargoRatioToGo) && supplies >= (expanderCargo.sup * this.minimalCargoRatioToGo) ) || vgap.myplanets[i].id === aps.base.id) // ignore mcs; always add the base planet, regardless if everything is available
            //if ((clans >= cutOff.cla && supplies >= cutOff.sup && mcs >= cutOff.mcs) || sourcePlanet.id == aps.base.id) // always add the base planet, regardless if everything is available
            {
                var distance = Math.floor(autopilot.getDistance({x: c.planet.x, y: c.planet.y}, {x:aps.ship.x ,y:aps.ship.y}));
                goodSources.push( { pid: c.planet.id, x: c.planet.x, y: c.planet.y, distance: distance, value: clans } );
            } else
            {
                console.log("... planet " + vgap.myplanets[i].id + " has no expander kit to offer!");
            }
        }
    }
    this.sources = autopilot.sortCollection(goodSources, "distance");
    console.warn("EXPANDER SOURCES >>");
    console.log(this.sources);
};
expanderAPS.prototype.isSource = function(planet)
{
    for (var i = 0; i < this.sources.length; i++)
    {
        if (this.sources[i].pid === planet.id) return true;
    }
    return false;
};
expanderAPS.prototype.setSecondaryDestination = function(aps)
{
    // check if cargo or planet contains expanderKit
    var planetKit = false;
    if (aps.planet)
    {
        planetKit = this.planetHasExpKit(aps);
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
            console.error("...couldn't find an adequate secondary destination.");
            // get the next ETA waypoint
            var nextWaypoint = aps.getEtaWaypoint(aps.base); // toDo: this can be a very slow solution, since the smallest ETA is always first
            if (nextWaypoint)
            {
                aps.secondaryDestination = nextWaypoint;
            } else {

                aps.secondaryDestination = aps.base;
                var closestplanet = autopilot.getClosestPlanet(aps.ship, 0, false);
                if (closestplanet) aps.secondaryDestination = closestplanet;
            }
        }
    }
};
expanderAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    if (aps.destination.ownerid !== vgap.player.id)
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
expanderAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    var conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    //console.log("Destination(" + potPlanet.id + ")HasSameAPStype: " + conflictAPS);
    if (conflictAPS)
    {
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        return true;
    }
};
expanderAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // aps.potDest = aps.potDest;
};
expanderAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
expanderAPS.prototype.handleCargo = function (aps)
{
    if (aps.planet)
    {
        if (!aps.isOwnPlanet && aps.destination.id === aps.planet.id)
        {
            // = new colony
            var enemyAtPlanet = autopilot.enemyShipAtPlanet(aps.planet);
            console.log("...enemyAtPlanet: " + enemyAtPlanet);
            if (!enemyAtPlanet)
            {
                aps.unloadCargo();
            }
        } else
        {
            if (this.loadCargo(aps))
            {
                // ok, we got expander Kit(s)
            } else
            {
                // we couldn't get expander Kit(s)!
                //
                // do we have a secondary destination, and are we there?
                if (aps.secondaryDestination && aps.planet.id === aps.secondaryDestination.id)
                {
                    // since we are at secondary destination and no Kit is available, we delete it and find another
                    aps.secondaryDestination = false;
                } // if we do not have a secondary destination, we will find one, if we aren't there, we proceed
            }
        }
    }
};
expanderAPS.prototype.setExpanderKit = function(aps)
{
    var clans = 0;
    if (aps.objectOfInterest === "slw")
    {
        // default on other missions: Clans / cargo = 75 % / 25 %
        // MDSF = 150 clans, 50 supply, 150 MC
        //
        clans = Math.floor(0.75 * aps.hull.cargo);
    } else
    {
        // default on exploration: Clans / cargo = 50 % / 50 %
        // MDSF = 100 clans, 100 supply, 300 MC
        //
        clans = Math.floor(0.50 * aps.hull.cargo);
    }
    var sups = aps.hull.cargo - clans;
    var mcs = 3 * (aps.hull.cargo - clans);
    this.expanderKit = {
        cla: clans,
        sup: sups,
        mcs: mcs
    };
};
expanderAPS.prototype.getExpanderKit = function(aps)
{
    if (!this.expanderKit) this.setExpanderKit(aps);
    return this.expanderKit;
};
expanderAPS.prototype.hasExpKit = function(aps)
{
    var expanderKit = this.getExpanderKit(aps);
    if (aps.objectOfInterest === "slw")
    {
        return ( (aps.ship.clans >= expanderKit.cla || aps.ship.clans >= 150) && (aps.ship.supplies >= expanderKit.sup || aps.ship.supplies >= 50)); // ignore mcs, maximum 150 clans and 50 supply per planet
    } else
    {
        return (aps.ship.clans >= 10 && aps.ship.supplies >= 10); // ignore mcs, maximum of 10 clans and 10 supply per planet
    }
};
expanderAPS.prototype.planetHasExpKit = function(aps, partially)
{
    var c = new Colony(aps.planet.id);
    if (c.isOwnPlanet)
    {
        var expExcSup = c.balance.supplies;
        if (c.hasStarbase) expExcSup = aps.planet.supplies - autopilot.settings.defSupRetention; // overwrite balance if at SB
        var expExcMcs = c.balance.megacredits;
        if (c.hasStarbase) expExcMcs = aps.planet.megacredits - autopilot.settings.defMcsRetention; // overwrite balance if at SB

        var expanderKit = this.getExpanderKit(aps);
        if (typeof partially === "undefined" || partially === false)
        {
            console.error("- Planet " + aps.planet.id + " has expander kit = " + (c.balance.clans >= expanderKit.cla && expExcSup >= expanderKit.sup && expExcMcs >= expanderKit.mcs));
            return (c.balance.clans >= expanderKit.cla && expExcSup >= expanderKit.sup && expExcMcs >= expanderKit.mcs);
        } else // partially
        {
            console.error("- Planet " + aps.planet.id + " has partial expander kit = " + (c.balance.clans >= expanderKit.cla));
            return (c.balance.clans >= expanderKit.cla);
        }
    }
    console.error("Planet " + aps.planet.id + ": not a colony?");
    return false;
};
expanderAPS.prototype.loadCargo = function(aps)
{
    var curCargo = 0;
    var curMCs = 0;
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
            curMCs = aps.loadObject("megacredits", aps.planet, (kDiffMcs*-1));
        }
        console.log("...loaded: cargo = " + curCargo + " MCs = " + curMCs);
    } else
    {
        console.log("...no Kit(s) available...");
    }
    return curCargo;
};
expanderAPS.prototype.transferCargo = function(aps)
{
    if (aps.planet && !aps.isOwnPlanet && aps.ship.transferclans < 1)
    {
        var unloadingSequence = [ "supplies", "clans", "megacredits" ];
        var maxAmounts = [ 50, 150, 150]; // slow colonization kit
        if (aps.objectOfInterest === "fst")
        {
            maxAmounts = [ 10, 10, 30]; // fast colonization kit
            if (aps.planet.nativeracename === "Amorphous") return; // don't transfer to amorphous planets
        }
        // calculate clans for population growth and adapt trasfer to that
        if (vgap.player.raceid === 7) // crystals
        {
            var popGrowth = aps.planet.temp / 100 * maxAmounts[1] / 20 * 5 / 5;
            if (popGrowth < 1)
            {
                var newAmount = maxAmounts[1];
                while (popGrowth < 1)
                {
                    newAmount += 1;
                    popGrowth = aps.planet.temp / 100 * newAmount / 20 * 5 / 5;
                }
                if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
            }
        } else
        {
            var popGrowth = aps.planet.temp * aps.planet.temp / 4000 * maxAmounts[1] / 20 * 5 / 5;
            if (popGrowth < 1)
            {
                var newAmount = maxAmounts[1];
                while (popGrowth < 1)
                {
                    newAmount += 1;
                    popGrowth = aps.planet.temp * aps.planet.temp / 4000 * newAmount / 20 * 5 / 5;
                }
                if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
            }
        }
        //
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
};/*
 * Autopilot - Terraform Module
 */
function hizzzAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of 10000 MCs (e.g. 0.7 = 7000 MC)
    this.turnRangeAmp = 1;
    this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.ooiPriority = "mcs"; // object of interest (ooi) priority: always "mcs"
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
hizzzAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
};
hizzzAPS.prototype.setSinks = function(aps)
{
    // as hizzzer, the base is always the sink
    this.sinks = [{ x: aps.base.x, y: aps.base.y, pid: aps.base.id, deficiency: -1 }];
};
hizzzAPS.prototype.getPlanetDeficiency = function(p, aps)
{
    return 0;
};
hizzzAPS.prototype.getPlanetExcess = function(p, aps)
{
    var c = new Colony(p.id);
    if (c.isOwnPlanet)
    {
        //console.log("...revenue of planet " + p.id + "= " + c.revenue);
        return c.revenue;
    } else
    {
        console.error("Planet " + p.id + " not a colony?");
        return 0;
    }
};
hizzzAPS.prototype.getMissionStatus = function(aps)
{
    if (this.isSource(aps.planet))
    {
        return aps.ship.megacredits / (10000 * this.minimalCargoRatioToGo);
    } else
    {
        return 1;
    }
};
hizzzAPS.prototype.getCurDeficiency = function(aps)
{
    return this.getPlanetDeficiency(aps.planet, aps);
};
hizzzAPS.prototype.setScopeRange = function(aps)
{
    var inRange = aps.getAPSinRange(aps.scopeRange);
    if (inRange && inRange.length > 3)
    {
        aps.scopeRange *= 3;
    } else
    {
        aps.scopeRange *= 2;
    }
};
hizzzAPS.prototype.setSources = function(aps)
{
    // as hizzzer, each planet with taxable population is a source
    // and the object of interest is to produce MCs and transport them to the base
    // priority are planets that generate most MCs
    this.setScopeRange(aps);
    var targetsInRange = aps.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    console.log("...targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
    var withNatives = [];
    var amorph = [];
    var potential = [];
    for (var i = 0; i < targetsInRange.length; i++)
    {
        var sP = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
        var c = new Colony(sP.id);
        if (c.isOwnPlanet && !c.isBuildingBase) // we don't suck other future starbases dry
        {
            var distance = Math.floor(autopilot.getDistance({x: sP.x, y: sP.y}, {x:aps.ship.x ,y:aps.ship.y}));
            var excess = c.getRevenue();
            if (excess === 0) continue;
            if (sP.nativeclans > 0 && sP.nativeracename === "Amorphous")
            {
                console.log("... there are amorphous natives living on " + sP.id + " ... sorting to the back...");
                amorph.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, value: excess, nativerace: sP.nativeracename });
                continue;
            } else if (sP.nativeclans > 0 && distance <= (2 * Math.pow(aps.ship.engineid, 2))) // only if in 2-turn range
            {
                console.log("... there are natives living on " + sP.id + " ...prioritise...");
                withNatives.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, value: excess, nativerace: sP.nativeracename });
                continue;
            }
            potential.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, value: excess, nativerace: sP.nativeracename });
        } else
        {
            if (c.isOwnPlanet)
            {
                console.log("... excluding colony " + sP.id + " since it is building a base...");
            } else
            {
                console.error("Colony does not exist: " + sP.id);
            }
        }
    }
    console.log("... potential targets: " + potential.length);
    console.log("... amorph targets: " + amorph.length);
    console.log("... other native targets: " + withNatives.length);
    potential = autopilot.sortCollection(potential, "value", "desc");
    if (potential.length > 0)
    {
        if (withNatives.length > 0)
        {
            // putting native planets to the top of the line...
            withNatives = autopilot.sortCollection(withNatives, "value", "desc");
            potential = withNatives.concat(potential);
        }
        if (amorph.length > 0)
        {
            // putting amorph planets to the end of the line...
            potential = potential.concat(amorph);
        }
        this.sources = potential;
    } else
    {
        if (withNatives.length > 0)
        {
            // putting native planets to the top of the line...
            withNatives = autopilot.sortCollection(withNatives, "value", "desc");
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
        this.sources = potential;
    }
};
hizzzAPS.prototype.isSource = function(planet)
{
    var c = new Colony(planet.id);
    return (c.getRevenue() > 100);
};
hizzzAPS.prototype.setSecondaryDestination = function(aps)
{
    //aps.secondaryDestination = false;
};
hizzzAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    if (aps.destination.ownerid !== vgap.player.id)
    {
        aps.potentialWaypoints.push({ pid: aps.destination.id, x: aps.destination.x, y: aps.destination.y });
    }
};
hizzzAPS.prototype.setPotentialDestinations = function(aps)
{
    var missionTarget = aps.base;
    if (aps.planet) missionTarget = aps.planet;

    if (missionTarget)
    {
        var c = new Colony(aps.planet.id);
        var curRevenue = c.getRevenue();
        var status = this.getMissionStatus(aps);
        console.log("Collected revenue: " + aps.ship.megacredits + " (" + (status * 100) + "%)");
        console.log("Local revenue: " + curRevenue);
        //
        if (status < 1)
        {
            var betterSources = [];
            this.setSources(aps);
            if (this.sources.length > 0)
            {
                this.sources = autopilot.sortCollection(this.sources, "distance", "desc");
                for (var i = 0; i < this.sources.length; i++)
                {
                    if (this.sources[i].distance > (aps.simpleRange * 2)) continue;
                    if (this.sources[i].value > curRevenue * 1.5) {
                        betterSources.push(this.sources[i]);
                    }
                }
            }
            if (betterSources.length === 0) return; // don't go anywhere as long as minimalCargoRatioToGo is not satisfied
            console.log("Better sources found:");
            console.log(betterSources);
            aps.potDest = betterSources;
        }
    }
    if (aps.potDest.length === 0)
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
            console.log("...for hizzer at base (sink)...");
            aps.potDest = this.sources;
        } else
        {
            // set base as only potential destination, if we are at a source
            console.log("...for hizzer at a (source) planet...");
            aps.potDest = this.sinks;
        }
    }
    if (aps.potDest.length === 0)
    {
        console.log("...no destinations available...");
        aps.isIdle = true;
        aps.updateStoredData();
    } else
    {
        aps.isIdle = false;
        aps.updateStoredData();
        console.log(aps.potDest);
    }
};
hizzzAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // aps.potDest = aps.potDest;
};
hizzzAPS.prototype.handleCargo = function (aps)
{
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.atBase) // we are at base (sink)
        {
            aps.unloadCargo();
        } else // source or waypoint
        {
            var transCargo = this.loadCargo(aps);
            console.log("Cargo summary: " + transCargo);
        }
    }
};
hizzzAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
hizzzAPS.prototype.loadCargo = function(aps)
{
    var curCargo = 0;
    if (aps.destination.id === aps.planet.id || (aps.planet.id === aps.lastDestination.id && aps.base.id !== aps.planet.id))
    {
        if (!(this.sellSupply === "notBov" && aps.planet.nativeracename === "Bovinoid"))
        {
            aps.sellSupply();
        }
        aps.loadMegacredits(aps.planet, Math.floor(aps.planet.megacredits * 0.75));
    } else
    {
        // always collect cash from intermediate stops, as long as there is no starbase
        // toDo: not all starbases need cash...
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
hizzzAPS.prototype.transferCargo = function(aps)
{

};/*
 * Autopilot - Terraform Module
 */
function terraformerAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.turnRangeAmp = 1;
    this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.ooiPriority = "cla"; // object of interest (ooi) priority: always "cla" toDo: switch to "col" for colonizing planets and "sbb" for starbase builder
    this.curOoi = false; // current object of interest (ooi), false if priority is not "all"
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
terraformerAPS.prototype.setCurrentOoi = function(aps)
{
    this.curOoi = false;
};
terraformerAPS.prototype.setSinks = function(aps)
{
    // as terraformer, each planet with a temperature other than the optimal is a sink
    // and the object of interest usually is nothing else than terraform
    // however, if it would be known that there are natives (bioscan) priority could be used for those planets
    // the same goes for planets where the resources are known
    // priority should be given to extreme planets (i.e. colder than 15° C and hotter than 84° C)
    this.setScopeRange(aps);
    var targetsInRange = aps.getTargetsInRange(autopilot.frnnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    console.log("...targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
    var withNatives = [];
    var amorph = [];
    var potential = [];
    for (var i = 0; i < targetsInRange.length; i++)
    {
        var sP = vgap.planetAt(targetsInRange[i].x, targetsInRange[i].y);
        if (sP)
        {
            var distance = Math.floor(autopilot.getDistance({x: sP.x, y: sP.y}, {x:aps.ship.x ,y:aps.ship.y}));
            var deficiency = this.getPlanetDeficiency(sP, aps);
            if (deficiency === 0) continue;
            if (sP.nativeclans > 0 && sP.nativeracename === "Amorphous")
            {
                console.log("... there are amorphous natives living on " + sP.id + " ... sorting to the back...");
                amorph.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename });
                continue;
            } else if (sP.nativeclans > 0 && distance <= (2 * Math.pow(aps.ship.engineid, 2))) // only if in 2-turn range
            {
                console.log("... there are natives living on " + sP.id + " ...prioritise...");
                withNatives.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename });
                continue;
            }
            potential.push({ x: sP.x, y: sP.y, pid: sP.id, distance: distance, deficiency: deficiency, nativerace: sP.nativeracename });
        }
    }
    console.log("... potential targets: " + potential.length);
    console.log("... amorph targets: " + amorph.length);
    console.log("... other native targets: " + withNatives.length);
    potential = autopilot.sortCollection(potential, "deficiency");
    if (potential.length > 0)
    {
        if (withNatives.length > 0)
        {
            // putting native planets to the top of the line...
            withNatives = autopilot.sortCollection(withNatives, "deficiency");
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
            withNatives = autopilot.sortCollection(withNatives, "deficiency");
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
terraformerAPS.prototype.getPlanetDeficiency = function(p, aps)
{
    if (p.temp === -1 || !autopilot.isFriendlyPlanet(p)) return 0; // exclude planets with unknown temperatures and hostile planets
    var pTemp = parseInt(p.temp);
    if (pTemp > 50 && aps.terraCooler)
    {
        return (50 - pTemp);
    } else if (pTemp < 50 && aps.terraHeater)
    {
        return (pTemp - 50);
    }
    return 0;
};
terraformerAPS.prototype.getCurDeficiency = function(aps)
{
    return this.getPlanetDeficiency(aps.planet, aps);
};
terraformerAPS.prototype.setScopeRange = function(aps)
{
    var inRange = aps.getAPSinRange(aps.scopeRange);
    if (inRange && inRange.length > 3)
    {
        aps.scopeRange *= 3;
    } else
    {
        aps.scopeRange *= 2;
    }
};
terraformerAPS.prototype.setSources = function(aps)
{
    // sources are not necessary...
    this.sources = [];
    console.log(this.sources);
};
terraformerAPS.prototype.isSource = function(planet)
{
    for (var i = 0; i < this.sources.length; i++)
    {
        if (this.sources[i].pid === planet.id) return true;
    }
    return false;
};
terraformerAPS.prototype.setSecondaryDestination = function(aps)
{
    //aps.secondaryDestination = false;
};
terraformerAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
    if (aps.destination.ownerid !== vgap.player.id)
    {
        aps.potentialWaypoints.push({ pid: aps.destination.id, x: aps.destination.x, y: aps.destination.y });
    }
};
terraformerAPS.prototype.setPotentialDestinations = function(aps)
{
    console.log("Terraforming status: " + this.getCurDeficiency(aps));
    if (this.getCurDeficiency(aps))
    {
        return; // don't go anywhere as long as the optimal temperature has not been reached
    }
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
terraformerAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // aps.potDest = aps.potDest;
};
terraformerAPS.prototype.handleCargo = function (aps)
{

};
terraformerAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
terraformerAPS.prototype.loadCargo = function(aps)
{

};
terraformerAPS.prototype.transferCargo = function(aps)
{

};/*
     *
     * Auto Pilot Control
     *
     */
var autopilot = {
    version: "0.9",
    /*
        @desc BROWSER STORAGE
    */
    storage: {},                    // storage for the nuPilot (ship missions, base, etc.)
    storageId: false,               // storage ID for the previous
    settings: {},                   // storage for the nuPilot configuration (settings)
    storageCfgId: false,            // storage ID for the previous
    pStorage: {},                   // storage for planet assignments and build strategies
    pStorageId: false,              // storage ID for the previous
    /*
        Objects
     */
    colony: [],                     // colony objects by planet id
    shipsByDestination: [],         // ship objects approaching planet with id (destination=ships targetx+y)
    /*
        DATA COLLECTIONS
    */
    globalMinerals: {},
    mineralMaxis: {},
    towedShips: [],                 // IDs of towed (my)ships
    chunnelShips: [],               // IDs of ships that will be chunnel
    robbedShips: [],                // IDs of ships that have been robbed

    hizzzerPlanets: [],
    frnnPlanets: [],
    frnnOwnPlanets: [],
    frnnEnemyMinefields: [],
    frnnWebMinefields: [],
    frnnEnemyWebMinefields: [],
    frnnFriendlyMinefields: [],
    frnnStarClusters: [],
    frnnEnemyShips: [],
    frnnEnemyPlanets: [],
    apsLocations: [],
    apsMissions: [],
    /*
        DEFICIENCIES
     */
    deficienciesByPlanet: {},
    clanDeficiencies: [],
    clanSources: [],
    neuDeficiencies: [],
    neuSources: [],
    mcsDeficiencies: [],
    mcSources: [],
    allDeficiencies: [],
    sbDeficiencies: [],
    /*

     */
    minerals: ["neutronium", "duranium", "tritanium", "molybdenum"],
    apsOOItext: {
        col: {
            all: "Minerals",
            neu: "Neutronium",
            dur: "Duranium",
            tri: "Tritanium",
            mol: "Molybdenum",
            cla: "Clans",
            mcs: "Megacredits",
            sup: "Supplies",
            name: "collecting"
        },
        dis: {
            all: "Everything",
            neu: "Fuel",
            sup: "Supplies",
            mcs: "Megacredits",
            cla: "Clans",
            name: "distributing"
        },
        bld: {
            bab: "Starbase",
            stb: "Planetary Structures",
            name: "building"
        },
        exp: {
            cla: "Clans",
            name: "colonizing"
        },
        ter: {
            cla: "Planet",
            name: "Terraforming"
        },
        hiz: {
            mcs: "Planet",
            name: "Hizzzing"
        },
        alc: {
            all: "Minerals",
            dur: "Duranium",
            tri: "Tritanium",
            mol: "Molybdenum",
            name: "producing"
        }
    },
    objectTypeEnum: {
        PLANETS     : 0,
        BASES       : 1,
        SHIPS       : 2,
        CLOAK       : 3,
        RGA         : 4,
        FORT        : 5,
        MINERALS    : 6
    },
    idColors: [
        "#00ff3f",
        "#3399FF",
        "#FFFF00",
        "#75a3a3",
        "#ff0000",
        "#cb42f4",
        "#B22222"   // firebrick
    ],
    baseCols: {
        0: "#FFFF00"
    },
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
    /*
        GENERAL GAME TASKS
     */
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
                if (msg.ownerid === vgap.player.id)
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
            } else if (msg.body.match(/have been robbed/) !== null)
            {
                console.warn("Ship " + msg.target + " has been robbed...");
                if (autopilot.robbedShips.indexOf(msg.target) === -1) autopilot.robbedShips.push(msg.target);
            }
        });
    },
    /*
     * planetaryManagement
     *  initializes myplanets -> colony objects
     *  -> set build targets according to planet mineral value (groundminerals...depletion)
     *  -> build structures
     *  -> set taxes
     *  -> initialize resource balance (deficiency / request & excess)
     *      > add transit fuel requests (ships at planet, APS at planet)
     *  -> initialize global mineral stats & mineral Maxis
     */
    planetaryManagement: function()
    {
        autopilot.initGlobalMinerals();
        autopilot.initMineralMaxis();
        for (var i = 0; i < vgap.myplanets.length; i++)
        {
            var p = vgap.myplanets[i];
            var c = new Colony(p.id, false); // initialize colony (no building)
            autopilot.minerals.forEach(function (m) {
                autopilot.globalMinerals[m] += p[m];
                autopilot.globalMinerals.values[m].push(p[m]);
                autopilot.globalMinerals.ground[m] += p["ground" + m];
                autopilot.globalMinerals.ground.values[m].push(p["ground" + m]);
                autopilot.globalMinerals.production[m] += c.mineralProduction[m];
                autopilot.globalMinerals.production.values[m].push(c.mineralProduction[m]);
                if (p[m] > autopilot.mineralMaxis[m]) autopilot.mineralMaxis[m] = p[m];
                if (p["ground" + m] > autopilot.mineralMaxis.ground[m]) autopilot.mineralMaxis.ground[m] = p["ground" + m];
                if (c.mineralProduction[m] > autopilot.mineralMaxis.production[m]) autopilot.mineralMaxis.production[m] = c.mineralProduction[m];
            });
        }
        console.log(autopilot.globalMinerals);
        for (i = 0; i < vgap.myplanets.length; i++)
        {
            p = vgap.myplanets[i];
            c = new Colony(p.id, true); // initialize colony and build
            // synchronize planeteer data
            var appData = autopilot.planetIsInStorage(p.id);
            autopilot.syncLocalPlaneteerStorage(appData);
        }
    },
    initGlobalMinerals: function()
    {
        autopilot.globalMinerals = {
            n: vgap.myplanets.length,
            neutronium: 0,
            duranium: 0,
            tritanium: 0,
            molybdenum: 0,
            values: {
                neutronium: [],
                duranium: [],
                tritanium: [],
                molybdenum: []
            },
            ground:  {
                neutronium: 0,
                duranium: 0,
                tritanium: 0,
                molybdenum: 0,
                values: {
                    neutronium: [],
                    duranium: [],
                    tritanium: [],
                    molybdenum: []
                }
            },
            production:  {
                neutronium: 0,
                duranium: 0,
                tritanium: 0,
                molybdenum: 0,
                values: {
                    neutronium: [],
                    duranium: [],
                    tritanium: [],
                    molybdenum: []
                }
            }
        };
    },
    initMineralMaxis: function()
    {
        autopilot.mineralMaxis = {
            n: vgap.myplanets.length,
            neutronium: 0,
            duranium: 0,
            tritanium: 0,
            molybdenum: 0,
            ground: {
                neutronium: 0,
                duranium: 0,
                tritanium: 0,
                molybdenum: 0
            },
            production: {
                neutronium: 0,
                duranium: 0,
                tritanium: 0,
                molybdenum: 0
            }
        };
    },
    getKpercentileThresh: function(values, k)
    {
        if (k > 100) k = 100;
        if (k < 1) k = 1;
        values.sort(function (a, b) {
            return a - b;
        });
        var index = (k / 100) * values.length;
        var roundedIndex = Math.ceil(index);
        if (index !== roundedIndex)
        {
            return values[roundedIndex];
        } else
        {
            if (index < values.length)
            {
                return Math.round( (values[index] + values[index+1]) / 2 );
            } else
            {
                return values[index];
            }
        }
    },
    /*
        SETUP / UPDATE APS
     */

    setupAPS: function(shipId, cfgData)
    {
        if (typeof cfgData === "undefined")
        {
            cfgData = autopilot.isInStorage(shipId); // false if not in storage
            console.error("Retry setting up APS " + shipId);
        } else
        {
            console.error("Setting up new APS " + shipId);
        }

        var ship = vgap.getShip(shipId);
        var aps = new APS(ship, cfgData); // INITIAL PHASE
        if (aps.isAPS)
        {
            if (aps.hasToSetPotDes)
            {
                console.warn("=> SET POTENTIAL DESTINATIONS: APS " + aps.ship.id);
                autopilot.populateFrnnCollections();
                autopilot.refreshColonies();
                aps.functionModule.setPotentialDestinations(aps); // PHASE 1
                if (aps.potDest.length > 0) {
                    console.warn("SET MISSION DESTINSTION: APS " + aps.ship.id);
                    aps.initAPScontrol();
                    aps.setMissionDestination(); // PHASE 2
                }
                aps.updateNote();
            }
            if (!aps.isIdle)
            {
                console.warn("CONFIRM MISSION: APS " + aps.ship.id);
                aps.confirmMission(); // PHASE 3
                autopilot.refreshColonies();
                aps.updateNote();
            }
        } else
        {
            aps.updateNote();
        }
    },
    updateAPS: function(shipId, cfgData)
    {
        console.error("Updating APS " + shipId);
        // toDo: not working
        /* var ship = vgap.getShip(shipId);
        autopilot.syncLocalStorage(cfgData);
        if (ship.note) ship.note.body += "(*)"; */
    },
    /*
     *  initializeAPScontrol: starts INITIAL PHASE for all APS
     *      - also sets note color for APS
     */
    initializeAPScontrol: function()
    {
        //
        //
        // APS - Initial setup...
        //
        var nCols = ["ff3399", "6666ff", "ffc299", "66b3ff", "ff99ff", "6699ff", "7fffd4", "ee3b3b"];
        var disCol = "D3D3D3";
        var expCol = "FFFF00";
        var apsControl = [];
        for (var i = 0; i < vgap.myships.length; i++)
        {
            var ship = vgap.myships[i];
            //
            // set APS note color
            //
            var cfgData = autopilot.isInStorage(ship.id);
            if (cfgData) // if configuration is available in storage
            {
                var aps = new APS(ship, cfgData); // INITIAL PHASE
                if (aps.primaryFunction === "dis")
                {
                    aps.noteColor = disCol;
                } else if (aps.primaryFunction === "exp")
                {
                    aps.noteColor = expCol;
                } else
                {
                    if (autopilot.baseCols[aps.base.id])
                    {
                        aps.noteColor = autopilot.baseCols[aps.base.id];
                    } else
                    {
                        if (nCols.length > 0)
                        {
                            autopilot.baseCols[aps.base.id] = nCols.shift();
                            aps.noteColor = autopilot.baseCols[aps.base.id];
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
            }
        }
        return apsControl;
    },
    /*
        LOCAL STORAGE HANDLING
     */
    setupStorage: function()
    {
        if (typeof(localStorage) === "undefined") {
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
        } else if(isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera === false && isIEedge === false) {
            // is Google Chrome
            autopilot.isChromeBrowser = true;
        } else {
            // not Google Chrome
        }

        var createdBy = vgap.game.createdby;
        if (vgap.game.createdby === "none") createdBy = vgap.player.username;
        autopilot.oldStorageId = "nuPilot" + "default" + vgap.game.id;
        autopilot.storageId = "nuPilot" + createdBy + vgap.game.id;
        autopilot.storageCfgId = "nuPilotCfg" + createdBy + vgap.game.id;
        autopilot.pStorageId = "nuPlaneteer" + createdBy + vgap.game.id;
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
                if (storedGameData[i].sid === shipId)
                {
                    if (typeof storedGameData[i].idle === "undefined") storedGameData[i].idle = false; // to make older data conform
                    return storedGameData[i];
                }
            }
        }
        return false;
    },
    planetIsInStorage: function(planetId)
    {
        var storedGameData = autopilot.loadPlaneteerData();
        if (storedGameData === null) // no storage setup yet
        {
            return false;
        } else
        {
            // storage available...
            for(var i = 0; i < storedGameData.length; i++)
            {
                // ...look for entry of the current APS
                if (storedGameData[i].pid === planetId)
                {
                    return storedGameData[i];
                }
            }
        }
        return false;
    },
    loadGameSettings: function()
    {
        var storedCfgData = JSON.parse(localStorage.getItem(autopilot.storageCfgId));
        if (typeof storedCfgData === "undefined" || storedCfgData === null) // no storage setup yet
        {
            var gdo = new APSSettings();
            var cfgData = gdo.getSettings();
            if (cfgData)
            {
                autopilot.saveGameSettings(cfgData);
                autopilot.settings = cfgData;
                return cfgData;
            } else
            {
                return false;
            }
        } else {
            var update = new APSSettings(storedCfgData);
            autopilot.saveGameSettings(update.getSettings());
            autopilot.settings = update.getSettings();
            return update.getSettings();
        }
    },
    saveGameSettings: function(settings)
    {
        console.log("saveGameSettings");
        console.log(settings);
        var gData = new APSSettings(settings);
        console.log(gData);
        localStorage.setItem(autopilot.storageCfgId, JSON.stringify(gData.getSettings()));
        autopilot.settings = gData.getSettings();
    },
    loadGameData: function(data)
    {
        var storedGameData = JSON.parse(localStorage.getItem(autopilot.storageId));
        if (storedGameData === null) // no storage setup yet
        {
            // try old storageId
            storedGameData = JSON.parse(localStorage.getItem(autopilot.oldStorageId));
            if (storedGameData === null) // no storage setup yet
            {
                if (typeof data === "undefined") return false;
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
            } else
            {
                return storedGameData;
            }
        } else {
            return storedGameData;
        }
    },
    saveGameData: function(gameData)
    {
        console.log("saveGameData");
        localStorage.setItem(autopilot.storageId, JSON.stringify(gameData));
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
                if (storedGameData[i].sid === data.sid)
                {
                    // if turned off
                    if (data.action === "END" || data.action === "DEL")
                    {
                        storedGameData.splice(i, 1); // delete stored data entry
                        if (data.action === "END")
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
                        if (data.base && storedGameData[i].base !== data.base) storedGameData[i].base = data.base;
                        // if idle status has changed, update
                        if (storedGameData[i].idle !== data.idle) storedGameData[i].idle = data.idle;
                        // if idle reason has changed, update
                        if (storedGameData[i].idleReason !== data.idleReason) storedGameData[i].idleReason = data.idleReason;
                        // if idle reason has changed, update
                        if (storedGameData[i].idleTurns !== data.idleTurns) storedGameData[i].idleTurns = data.idleTurns;
                        // if destination is provided, update/set
                        if (storedGameData[i].destination !== data.destination) storedGameData[i].destination = data.destination;
                        if (storedGameData[i].secondaryDestination !== data.secondaryDestination) storedGameData[i].secondaryDestination = data.secondaryDestination;
                        if (storedGameData[i].lastDestination !== data.lastDestination) storedGameData[i].lastDestination = data.lastDestination;
                        if (storedGameData[i].currentOoi !== data.currentOoi) storedGameData[i].currentOoi = data.currentOoi;
                        var syncedData = new APSdata(storedGameData[i]); // synchronize stored data
                        storedGameData[i] = syncedData;
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
    loadPlaneteerData: function(data)
    {
        var storedPlaneteerData = JSON.parse(localStorage.getItem(autopilot.pStorageId));
        if (storedPlaneteerData === null) // no storage setup yet, setup
        {
            if (typeof data === "undefined") return false;
            var pd = new APPdata(data);
            var gameData = pd.getData();
            if (gameData)
            {
                storedPlaneteerData = [];
                storedPlaneteerData.push(gameData);
                autopilot.savePlaneteerData(storedPlaneteerData);
                return storedPlaneteerData;
            } else
            {
                return false;
            }
        } else {
            return storedPlaneteerData;
        }
    },
    savePlaneteerData: function(planetData)
    {
        //console.log("savePlaneteerData");
        localStorage.setItem(autopilot.pStorageId, JSON.stringify(planetData));
    },
    syncLocalPlaneteerStorage: function(data)
    {
        // load data
        var storedGameData = autopilot.loadPlaneteerData(data);
        if (!storedGameData) // error
        {
            console.error("Mandatory field empty!");
            return false;
        } else
        {
            // storage available...
            for(var i = 0; i < storedGameData.length; i++)
            {
                // ...look for entry of planet
                if (storedGameData[i].pid === data.pid)
                {
                    // TURN-OFF routines
                    //
                    // taxation off
                    if (data.taxation === "off" && storedGameData[i].taxation !== "off")
                    {
                        var p = vgap.getPlanet(data.pid);
                        p.colonisttaxrate = 0;
                        p.nativetaxrate = 0;
                    }
                    //
                    var syncedData = new APPdata(data); // synchronize stored data
                    storedGameData[i] = syncedData.getData();
                    autopilot.savePlaneteerData(storedGameData);
                    return storedGameData[i];
                }
            }
            // if planet is not stored yet, add to storage
            var gdo = new APPdata(data);
            var gameData = gdo.getData();
            storedGameData.push(gameData);
            autopilot.savePlaneteerData(storedGameData);
            return gameData;
        }
    },
    /*
        DATA COLLECTIONS
     */
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
            if (minefield.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(minefield.ownerid))
            {
                autopilot.frnnEnemyMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
            } else {
                autopilot.frnnFriendlyMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
            }
            if (minefield.isweb)
            {
                if (minefield.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(minefield.ownerid))
                {
                    autopilot.frnnEnemyWebMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                } else {
                    autopilot.frnnWebMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                }
            }
        });
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
            autopilot.frnnPlanets.push( {pid: planet.id, x: planet.x, y: planet.y} );
            if (planet.ownerid > 0 && planet.ownerid === vgap.player.id) autopilot.frnnOwnPlanets.push( {pid: planet.id, x: planet.x, y: planet.y} );
            if (planet.ownerid > 0 && planet.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(planet.ownerid))
            {
                autopilot.frnnEnemyPlanets.push( {pid: planet.id, x: planet.x, y: planet.y} );
            }
            // toDo: ownerid === 0 = unowned? or also unknown owner?
            if (planet.ownerid === 0) autopilot.frnnUnownedPlanets.push( {pid: planet.id, x: planet.x, y: planet.y} );
        });
    },
    populateShipCollections: function()
    {
        for (var i = 0; i < vgap.myships.length; i++) {
            var ship = vgap.myships[i];
            if (ship.mission === 6 && autopilot.towedShips.indexOf(ship.mission1target) === -1) autopilot.towedShips.push(ship.mission1target);
            if (ship.hullid === 56 && ship.warp === 0) // Firecloud at warp 0
            {
                if (ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 49) // initiating a chunnel ?
                {
                    // check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                    var receiver = vgap.getShip(ship.friendlycode);
                    if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== ship.x || receiver.y !== ship.y)) {
                        autopilot.updateChunnelTraffic(ship);
                    } else {
                        ship.friendlycode = "00c";
                    }
                } else {
                    var inList = autopilot.chunnelShips.indexOf(ship.id);
                    if (inList > -1) {
                        autopilot.chunnelShips.splice(inList, 1);
                        if (ship.friendlycode.match(/\d\d\d/)) ship.friendlycode = "00c";
                    }
                }
            } else if (ship.hullid === 56 && ship.warp > 0)
            {
                if (ship.friendlycode === "00c") ship.friendlycode = "abc";
            }
        }
    },
    updateChunnelTraffic: function(ship)
    {
        var ships = vgap.shipsAt(ship.x, ship.y);
        if (ships)
        {
            for( var i = 0; i < ships.length; i++)
            {
                if ((ships[i].targetx === ships[i].x && ships[i].targety === ships[i].y) || ships[i].warp === 0)
                {
                    if (autopilot.chunnelShips.indexOf(ships[i].id) === -1) autopilot.chunnelShips.push(ships[i].id); // add ship to chunnel-ship-list
                }
            }
        }
    },
    refreshColonies: function()
    {
        for (var i = 0; i < vgap.myplanets.length; i++)
        {
            var p = vgap.myplanets[i];
            autopilot.colony[p.id] = new Colony(p.id);
        }
        //console.log(autopilot.colony);
    },
    getAPSbyBase: function()
    {
        var apsData = autopilot.loadGameData();
        var apcBaseIds = [];
        var apcByBase = {};
        for (var i = 0; i < apsData.length; i++)
        {
            apcBaseIds.push(apsData[i].base);
            //
            if (typeof apcByBase[apsData[i].base] === "undefined") apcByBase[apsData[i].base] = [];
            apcByBase[apsData[i].base].push({
                sid: apsData[i].sid,
                destination: apsData[i].destination,
                secondaryDestination: apsData[i].secondaryDestination,
                shipFunction: apsData[i].shipFunction,
                ooiPriority: apsData[i].ooiPriority,
                idle: apsData[i].idle,
                idleReason: apsData[i].idleReason,
                idleTurns: apsData[i].idleTurns
            });
        }
        return apcByBase;
    },
    getShipsByDestinationPlanet: function(planet)
    {
        var sBD = {};
        for (var i = 0; i < vgap.myships.length; i++)
        {
            var curDestination = vgap.planetAt(vgap.myships[i].targetx, vgap.myships[i].targety);
            if (curDestination)
            {
                if (typeof sBD[curDestination.id] === "undefined") sBD[curDestination.id] = [];
                sBD[curDestination.id].push(vgap.myships[i]);
            }
        }
        autopilot.shipsByDestination = sBD;
        if (typeof planet === "undefined")
        {
            return sBD;
        } else {
            if (typeof sBD[planet.id] === "undefined")
            {
                return [];
            } else {
                return sBD[planet.id];
            }
        }
    },
    /*
        SHIP / PLANET / STARBASE / PLAYER INFOS
     */
    specialShipAtPlanet: function(planet, hullid)
    {
        var ships = vgap.shipsAt(planet.x, planet.y);
        if (ships.length > 0)
        {
            for (var i = 0; i < ships.length; i++)
            {
                if (ships[i].hullid === hullid && ships[i].friendlycode !== "nal") return true;
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
    isFriendlyPlanet: function(planet)
    {
        return (planet.ownerid === vgap.player.id || autopilot.isFriendlyPlayer(planet.ownerid));
    },
    enemyShipAtPlanet: function(planet, playerid)
    {
        var ships = vgap.shipsAt(planet.x, planet.y);
        if (ships.length > 0)
        {
            for (var i = 0; i < ships.length; i++)
            {
                if (ships[i].ownerid === vgap.player.id) continue;
                if (!autopilot.isFriendlyPlayer(ships[i].ownerid)) return true;
            }
        }
        return false;
    },
    isFriendlyPlayer: function(playerId)
    {
        for (var i = 0; i < vgap.relations.length; i++)
        {
            if (vgap.relations[i].playertoid === playerId)
            {
                return (vgap.relations[i].relationto >= 2);
            }
        }
    },
    shipIsWellBouncing: function(ship)
    {
        // ship in orbit && warp speed > 1 && target == warp well
        var atPlanet = vgap.planetAt(ship.x, ship.y);
        if (atPlanet && ship.warp > 1)
        {
            return (autopilot.getDistance(atPlanet, { x: ship.targetx, y: ship.targety }) <= 3);
        } else {
            return false;
        }
    },
    shipTargetIsSet: function(ship)
    {
        return (ship.x !== ship.targetx || ship.y !== ship.targety);
    },
    /*
        getOptimalFuelConsumptionEstimate:
            shipId (int) of the ship we are getting a fuel consumption estimate for
            cargo (array of values) that is used for calculations, OPTIONAL
                if undefined, current cargo (values) is used
            distance (int) that is used for calculations, OPTIONAL
                if undefined, distance between ship and its target is used
     */
    getOptimalFuelConsumptionEstimate: function(sid, cargo, distance)
    {
        var ship = vgap.getShip(sid);
        if (typeof distance === "undefined") distance = Math.ceil(autopilot.getDistance( { x: ship.x, y: ship.y }, { x: ship.targetx, y: ship.targety } ));
        if (typeof cargo === "undefined") cargo = [];
        var hullCargoMass = autopilot.getHullCargoMass(sid, cargo); // without fueltank content, if cargo is an emty array, current ship cargo is used
        //console.log("HullCargoMass = " + hullCargoMass);
        var warp = ship.engineid;
        var hull = vgap.getHull(ship.hullid);
        var maxTurnDist = Math.pow(warp, 2);
        var travelTurns = Math.ceil(distance / maxTurnDist);
        var fFactor = autopilot.fuelFactor["t" + ship.engineid][warp]; // currently applicable fuel factor
        var penalty = 0;
        if (hull.cancloak) // toDo: && ship.mission === 9 && !hull.special.match(/advanced Cloak/)
        {
            var minPenalty = 5;
            var massPenalty = Math.ceil(hull.mass / 20);
            if (massPenalty > minPenalty)
            {
                penalty += massPenalty;
            } else
            {
                penalty += minPenalty;
            }
            penalty *= travelTurns;
        } // toDo: other additional fuel requirenment
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
        if (ship.hullid === 96) // = cobol class research
        {
            actualConsumption = vgap.turnFuel(maxTurnDist, hullCargoMass + basicConsumption, fFactor, maxTurnDist, penalty);
            actualConsumption++;
        }
        return actualConsumption;
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
    getAPSwithDestination: function(p)
    {
        var apsWithDest = [];
        for (var i = 0; i < vgap.myships.length; i++)
        {
            var sData = autopilot.isInStorage(vgap.myships[i].id);
            if (sData)
            {
                if (sData.destination === p.id) apsWithDest.push(sData);
            }
        }
        return apsWithDest;
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
    getTechDeficiency: function(curTech, wantTech)
    {
        if (curTech === 10) return 0;
        if (typeof wantTech === "undefined") wantTech = 10;
        if (typeof wantTech !== "undefined" && wantTech < 2) wantTech = 2;
        var def = 0;
        for (var i = curTech; i < wantTech; i++)
        {
            curCost = i * 100;
            def += curCost;
        }
        return def;
    },
    getSumOfSurfaceMinerals: function(planet)
    {
        var p = planet;
        return parseInt(p.duranium+p.tritanium+p.molybdenum);
    },
    /*
        UTILITIES
     */
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
    clearShipTarget: function(shipId)
    {
        var ship = vgap.getShip(shipId);
        ship.targetx = ship.x;
        ship.targety = ship.y;
    },
    clearShipNote: function(shipId)
    {
        var note = vgap.getNote(shipId, 2);
        if (note)
        {
            note.body = "";
        }
    },
    /*
        getClosestPlanet: looks within a certain range (200lj) around coordinates for planets, sorts them by distance and returns candidate.
            coordinates { x: a.x, y: a.y }
            candidate to return (int)
     */
    getClosestPlanet: function(coords, candidate, all)
    {
        if (typeof coords === "undefined") return false;
        if (typeof all === "undefined") all = false;
        var planets = [];
        //console.log({ x: coords.x, y: coords.y});
        //console.log(autopilot.frnnOwnPlanets);
        var closestPlanets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 200);
        if (all) closestPlanets = autopilot.getTargetsInRange(autopilot.frnnPlanets, coords.x, coords.y, 200);
        for (var i = 0; i < closestPlanets.length; i++)
        {
            var cP = vgap.getPlanet(closestPlanets[i].pid);
            if (cP)
            {
                var distance = Math.ceil(autopilot.getDistance( {x: cP.x, y: cP.y}, {x: coords.x ,y: coords.y} ));
                var dataEntry = { planet: cP, distance: distance };
                planets.push(dataEntry);
            }
        }
        //console.log("...found " + planets.length + " close planets.");
        if (planets.length > 1)
        {
            var sorted = autopilot.sortCollection(planets, "distance", "asc");
            //console.log(sorted);
            if (typeof candidate === "undefined")
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
        } else if (planets.length > 0)
        {
            return planets[0];
        }
        return false;
    },
    /*
        INDICATORS
     */
    planetIdleIndicator: function(planet)
    {
        if (autopilot.settings.planetGFX) {
            var c = new Colony(planet.id);
            if (c.isOwnPlanet && vgap.map.zoom > 5.1) {
                // STRUCTURES
                //
                // defense
                var markup = {
                    attr: {
                        stroke: "#FF1493", // deeppink
                        lineWidth: 6,
                        lineCap: "round",
                        lineDash: false
                    }
                };
                var planetDefense = planet.defense / autopilot.getCurrentMaxDefense(planet);
                autopilot.drawHorizontalLine(planet.x, planet.y, 1, "se", markup.attr, null, 0.3, 1, 10);
                if (planet.defense > 0) autopilot.drawHorizontalLine(planet.x, planet.y, 1, "se", markup.attr, null, 0.5, planetDefense, 10);
                //
                // factories
                var f = planet.factories;
                var mF = c.maxColPop;
                var tF = planet.targetfactories;
                var ratioM = f / mF;
                var ratioT = f / tF;
                if (tF < mF) {
                    ratio = ratioM;
                } else {
                    ratio = ratioT;
                }
                if (planet.factories === 0) {
                    markup.attr.stroke = "#FF4500"; // orangered
                    autopilot.drawHorizontalLine(planet.x, planet.y, 2, "se", markup.attr, null, 0.3, 1, 10);
                } else {
                    markup.attr.stroke = "#20B2AA"; // lightseagreen
                    autopilot.drawHorizontalLine(planet.x, planet.y, 2, "se", markup.attr, null, 0.3, 1, 10);
                    autopilot.drawHorizontalLine(planet.x, planet.y, 2, "se", markup.attr, null, 0.5, ratio, 10);
                    //autopilot.drawHorizontalLine(planet.x, planet.y, 2, "se", markup.attr, null, 0.5, ratio2, 10);
                }
                //
                // mines
                var m = planet.mines;
                var mM = c.maxColPop;
                var tM = planet.targetmines;
                ratio1 = m / mM;
                ratio2 = m / tM;
                if (planet.mines === 0) {
                    markup.attr.stroke = "#FF4500"; // orangered
                    autopilot.drawHorizontalLine(planet.x, planet.y, 3, "se", markup.attr, null, 0.3, 1, 10);
                } else {
                    markup.attr.stroke = "#00BFFF"; // deepskyblue
                    autopilot.drawHorizontalLine(planet.x, planet.y, 3, "se", markup.attr, null, 0.4, 1, 10);
                    autopilot.drawHorizontalLine(planet.x, planet.y, 3, "se", markup.attr, null, 0.6, ratio1, 10);
                }
                //
                // POPULATION
                // clans
                var clans = c.planet.clans;
                var maxCla = c.maxColPop;
                var ratio = clans / maxCla;
                markup.attr.lineWidth = 6;
                markup.attr.stroke = "#778899"; // lightslategray
                autopilot.drawHorizontalLine(planet.x, planet.y, 4, "se", markup.attr, null, 0.5, ratio, 10);
                autopilot.drawHorizontalLine(planet.x, planet.y, 4, "se", markup.attr, null, 0.3, 1, 10);
                //
                // MINERALS
                markup = {
                    attr: {
                        lineWidth: 6,
                        lineCap: "butt",
                        lineDash: false
                    }
                };
                var minCol = {
                    neutronium: "#B22222",   // firebrick
                    duranium: "#00bfff",
                    tritanium: "#ff8000",
                    molybdenum: "#0040ff"
                };
                var pos = {
                    baseD: 5,
                    withinD: 1,
                    betweenD: 3
                };
                var minMax = autopilot.mineralMaxis;
                for (var i = 0; i < autopilot.minerals.length; i++) {
                    var min = autopilot.minerals[i];
                    var gm = "ground" + autopilot.minerals[i];
                    var curRatio = planet[min] / minMax[min];
                    markup.attr.stroke = minCol[min];
                    markup.attr.lineDash = false;
                    autopilot.drawVerticalLine(planet.x, planet.y, pos.baseD + (i * pos.betweenD), "ne", markup.attr, null, 0.5, curRatio, 20);
                    var curGratio = planet[gm] / minMax.ground[min];
                    markup.attr.lineDash = [5, 3]; // [line, space]
                    autopilot.drawVerticalLine(planet.x, planet.y, pos.baseD + (i * pos.betweenD) + pos.withinD, "ne", markup.attr, null, 0.3, curGratio, 20);
                }
            }
        }
    },
    apsIndicators: function()
    {
        for (var i = 0; i < vgap.myships.length; i++)
        {
            var markup = {
                attr : {
                    stroke : autopilot.idColors[autopilot.objectTypeEnum.SHIPS],
                    lineWidth: 2,
                    lineCap: "round",
                    lineDash: [5,5]
                }
            };
            var ship = vgap.myships[i];
            var cfgData = autopilot.isInStorage(ship.id);
            if (cfgData)
            {
                autopilot.drawScaledCircle(ship.x, ship.y, 5, markup.attr, null, 0.5); // general APS indicator circle
                var bP = vgap.getPlanet(cfgData.base);
                if (bP) autopilot.drawScaledQuarterCircle(bP.x, bP.y, 6, "nw", markup.attr, null, 0.5); // APS BASE indicator
            }
        }
    },
    shipRGAIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            var markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.RGA],
                    lineWidth: 3,
                    lineCap: "round",
                    lineDash: [5, 20]
                }
            };
            if (vgap.player.id === 10 && ship.mission === 8) // Rebel Ground Attack
            {
                var maxDash = markup.attr.lineDash[1];
                for (var i = 0; i < maxDash; i++) {
                    markup.attr.lineDash = [markup.attr.lineDash[0], markup.attr.lineDash[0] + i];
                    autopilot.drawScaledQuarterCircle(ship.targetx, ship.targety, 10 - (i * 0.5), "sw", markup.attr, null, 0.5);
                    /*for (var j = 0; j < (maxDash * 5); j++)
                    {
                        autopilot.drawScaledQuarterCircle(ship.targetx, ship.targety, 10 - (i * 0.5 + (j * 0.1)), "sw", markup.attr, null, 0.5);
                    } */
                }
            }
        }
    },
    shipCloakIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            var markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.CLOAK],
                    lineWidth: 3,
                    lineCap: "round",
                    lineDash: [5, 5]
                }
            };
            var hull = vgap.getHull(ship.hullid);
            if (ship.iscloaked || (hull && hull.cancloak && ship.mission === 9)) {
                var alpha = 0.5;
                if (ship.iscloaked) alpha = 0.9;
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 10, "sw", markup.attr, null, alpha);
            }
        }
    },
    shipRobbedIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            var markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.RGA],
                    lineWidth: 2,
                    lineCap: "round",
                    lineDash: false
                }
            };
            if (autopilot.robbedShips.indexOf(ship.id) !== -1) {
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 10, "se", markup.attr, null, 0.5);
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 8, "se", markup.attr, null, 0.5);
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 6, "se", markup.attr, null, 0.5);
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 4, "se", markup.attr, null, 0.5);
            }
        }
    },
    shipIdleIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            var markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.SHIPS],
                    lineWidth: 3,
                    lineCap: "round",
                    lineDash: false
                }
            };
            // ship is idle if
            //      warp is set to 0
            //      or no destination is set
            //      or destination is set so ship will bounce back to planet
            //      and ship is not being towed
            //      and ship is not being sucked into a warp chunnel
            //
            if (ship.hullid === 56) // firecloud
            {
                var isReceiver = false;
                var isInitiator = false;
                if (ship.warp === 0 && ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 49) // initiating a chunnel?
                {
                    // check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                    var receiver = vgap.getShip(ship.friendlycode);
                    if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== ship.x || receiver.y !== ship.y)) {
                        autopilot.updateChunnelTraffic(ship);
                        isInitiator = true;
                    } else {
                        ship.friendlycode = "00c";
                    }
                } else if (ship.warp === 0 && !ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 0) // receiving a chunnel?
                {
                    var padId = String(ship.id);
                    if (ship.id < 100) {
                        if (ship.id < 10) {
                            padId = "00" + ship.id;
                        } else {
                            padId = "0" + ship.id;
                        }
                    }
                    for (var i = 0; i < vgap.myships.length; i++) {
                        var curCS = vgap.myships[i];
                        if (curCS.hullid === 56 && curCS.warp === 0 && curCS.friendlycode === padId) {
                            autopilot.chunnelShips.push(ship.id);
                            isReceiver = true;
                        }
                    }
                }
                if (!isReceiver && !isInitiator) {
                    var inList = autopilot.chunnelShips.indexOf(ship.id);
                    if (inList > -1) {
                        autopilot.chunnelShips.splice(inList, 1);
                        if (ship.friendlycode.match(/\d\d\d/)) ship.friendlycode = "00c";
                    }
                }
            }
            if ((ship.warp === 0 || !autopilot.shipTargetIsSet(ship) || autopilot.shipIsWellBouncing(ship)) &&
                autopilot.towedShips.indexOf(ship.id) === -1 && autopilot.chunnelShips.indexOf(ship.id) === -1) {
                var cfgData = autopilot.isInStorage(ship.id);
                // exclude
                //      a) active alchemy ships,
                //      b) ships building fighters (only ships with stardrive),
                //      c) ships being cloned
                //
                if ((cfgData && (cfgData.shipFunction === "alc" || cfgData.shipFunction === "ter" || cfgData.shipFunction === "hiz")) ||
                    (ship.hullid === 104 && ship.supplies > 0 && (ship.duranium > 0 || ship.tritanium > 0 || ship.molybdenum > 0)) ||
                    (ship.hullid === 105 && ship.supplies > 0) ||
                    (ship.friendlycode.toLowerCase() === "lfm" && ship.engineid === 1) ||
                    ship.friendlycode.toLowerCase() === "cln") {
                    //
                } else {
                    markup.attr.stroke = "#FFA500";
                    // toDo: if at planet quarter circle
                    autopilot.drawScaledQuarterCircle(ship.x, ship.y, 13, "sw", markup.attr, null, 0.7);
                    // toDo: else...
                    // autopilot.drawScaledCircle(ship.x, ship.y, 14, markup.attr, null, 0.7);
                }
            }
        }
    },
    /*
        UNSORTED
     */
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
    getTargetsInRange: function(coords, x, y, r)
    {
        var frnn = new FRNN(coords, r);
        return frnn.inRange( { x: x, y: y }, r);
    },
    getDistance: function(p1, p2, exact)
    {
        if (typeof exact === "undefined") exact = true;
        var destIsPlanet = vgap.planetAt(p2.x, p2.y);
        var dist = Math.sqrt((Math.pow((parseInt(p1.x) - parseInt(p2.x)),2) + Math.pow((parseInt(p1.y) - parseInt(p2.y)),2)));
        if (!exact && destIsPlanet && dist >= 2.2) dist -= 2.2;
        return dist;
    },
    getCargoCapacity: function(ship)
    {
        console.log(ship);
        var hull = vgap.getHull(ship.hullid);
        var capacity = hull.cargo;
        //console.log("autopilot.capacity: " + capacity);
        var components = [
            ship.duranium,
            ship.tritanium,
            ship.molybdenum,
            ship.supplies,
            ship.ammo, // torpedos or fighters
            ship.clans
        ];
        components.forEach(function(comp) { capacity -= parseInt(comp); });
        return capacity;
    },
    getHullCargoMass: function(sid, scargo)
    {
        var beamTecMass = [0,1,1,2,4,3,4,7,5,7,6];
        var torpTecMass = [0,2,2,2,4,2,2,3,2,3,3];
        var ship = vgap.getShip(sid);
        var hull = vgap.getHull(ship.hullid);
        var hullCargoMass = hull.mass;
        var maxHullCargoMass = hull.mass + hull.cargo;
        if (typeof scargo !== "undefined" && scargo.length > 0)
        {
            scargo.push(ship.beams * beamTecMass[ship.beamid]);
            scargo.push(ship.torps * torpTecMass[ship.torpedoid]);
            scargo.push(ship.ammo);
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
    getBuildingLabor: function(planet)
    {
        // use targetmines instead of mines to react to planeteer plugin behaviour
        var mines = planet.targetmines;
        var factories = planet.targetfactories;
        var defense = planet.targetdefense;
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
        var curStructures = pStructures[0].n;
        var curThresh = pStructures[0].thresh;
        //
        var extraStructures = curStructures - curThresh;
        if (extraStructures > 0)
        {
            return curThresh + Math.pow(extraStructures, 2);
        } else
        {
            return curStructures;
        }
    },
    getNativeLabor: function(planet)
    {
        var natDef = 0;
        if (planet.nativeclans > 0) natDef = autopilot.getNativeTaxClanDeficiency(planet);
        var bovDef = 0;
        if (planet.nativeracename === "Bovinoid") bovDef = autopilot.getBovinoidSupClanDeficiency(planet);
        return {
            taxation: natDef,
            supply: bovDef
        };
    },
    getMaxClanDeficiency: function(planet)
    {
        var natDef = 0;
        if (planet.nativeclans > 0) natDef = autopilot.getNativeTaxClanDeficiency(planet);
        var bovDef = 0;
        if (planet.nativeracename === "Bovinoid") bovDef = autopilot.getBovinoidSupClanDeficiency(planet);
        var bldDef = autopilot.getBuildingClanDeficiency(planet);
        //
        var allDef = [bldDef];
        if (natDef !== 0) allDef.push(natDef);
        if (bovDef !== 0) allDef.push(bovDef);
        if (allDef.length > 1)
        {
            allDef.sort(function(a, b) { return a-b; });
        }
        return allDef[0]; // use most severe deficiency
    },
    getBaseDeficiency: function(planet)
    {
        //  a) a starbase exists at base planet,
        //      and its primary function is
        //      ship production
        //      or forticifaction
        //  b) a base should be built
        //
        // cash
        var mcsDef = 0;
        // ship production or torpedo supply cost (minerals)
        var durDef = 0;
        var triDef = 0;
        var molDef = 0;
        var sb = vgap.getStarbase(planet.id);
        var c = new Colony(planet.id);
        if (sb)
        {
            // figther cost
            triDef += (200 - sb.fighters) * 3;
            molDef += (200 - sb.fighters) * 2;
            mcsDef += (200 - sb.fighters) * 100;
            // techlevel upgrade cost (mcs)
            var enginetechDef = 0;
            var hulltechDef = 0;
            var beamtechDef = 0;
            var torptechDef = 0;
            //
            if (c.isFort)
            {
                beamtechDef = autopilot.getTechDeficiency(sb.beamtechlevel);
                mcsDef = (enginetechDef + hulltechDef + beamtechDef + torptechDef);
                // base defense
                durDef += (200 - sb.defense);
                mcsDef += (200 - sb.defense) * 10;
                // torpedo building backup
                durDef += 100;
                triDef += 100;
                molDef += 100;
                mcsDef += 100 * 2; // toDo: mark 8 torp cost
            } else
            {
                enginetechDef = autopilot.getTechDeficiency(sb.enginetechlevel);
                hulltechDef = autopilot.getTechDeficiency(sb.hulltechlevel);
                beamtechDef = autopilot.getTechDeficiency(sb.beamtechlevel);
                torptechDef = autopilot.getTechDeficiency(sb.torptechlevel);
                mcsDef = (enginetechDef + hulltechDef + beamtechDef + torptechDef);
                //
                if (sb.enginetechlevel === 10 && sb.hulltechlevel > 9)
                {
                    // set required minerals for capital ship production
                    if (sb.beamtechlevel > 4 && (vgap.player.raceid === 10 || vgap.player.raceid === 11)) // rebels (10), colonies (11)
                    {
                        // carrier production
                    } else if (sb.beamtechlevel > 4 && sb.torptechlevel > 4 && (vgap.player.raceid === 1 || vgap.player.raceid === 3))  // fed (1), birds (3)
                    {
                        // torp race
                    }
                } else if (sb.enginetechlevel === 10 && sb.hulltechlevel > 5)
                {
                    // set required minerals for LDSF, medium ship production
                    mcsDef += 760;
                    durDef += 117;
                    triDef += 13;
                    molDef += 78;
                    // toDo: add tranquilly, patriot cost for rebells & colonies
                    // toDo: add resolute cost for birds
                } else if (sb.enginetechlevel === 10 && sb.hulltechlevel > 2)
                {
                    // set required minerals for MDSF + NFC production
                    mcsDef += 365 + 620;
                    durDef += 20 + 42;
                    triDef += 7 + 8;
                    molDef += 41 + 90;
                    // toDo: add cobol class research (colos)
                }
            }
            return { mcs: planet.megacredits - mcsDef, dur: planet.duranium - durDef, tri: planet.tritanium - triDef, mol: planet.molybdenum - molDef };
        } else
        {
            if (c.isBuildingBase)
            {
                if (900 - planet.megacredits > 0) mcsDef += (900 - planet.megacredits);
                if (120 - planet.duranium > 0) durDef += (120 - planet.duranium);
                if (402 - planet.tritanium > 0) triDef += (402 - planet.tritanium);
                if (340 - planet.molybdenum > 0) molDef += (340 - planet.molybdenum);
                return { mcs: mcsDef, dur: durDef, tri: triDef, mol: molDef };
            }
        }
        return false;
    },
    getMineralExcess: function(p)
    {
        var c = new Colony(p.id);
        var excess = 0;
        if (c.balance.duranium > 0) excess += c.balance.duranium;
        if (c.balance.tritanium > 0) excess += c.balance.tritanium;
        if (c.balance.molybdenum > 0) excess += c.balance.molybdenum;
        return excess;
    },
    getSumAvailableObjects: function(planet, object, module)
    {
        var c = new Colony(planet.id);
        if (object === "clans" || object === "cla")
        {
            if (c.balance.clans > 0) return c.balance.clans;
        } else if (object === "neutronium" ||object === "neu")
        {
            if (c.balance.neutronium > 0) return c.balance.neutronium;
        } else if (object === "duranium" || object === "dur")
        {
            if (c.balance.duranium > 0) return c.balance.duranium;
        } else if (object === "tritanium" || object === "tri")
        {
            if (c.balance.tritanium > 0) return c.balance.tritanium;
        } else if (object === "molybdenum" || object === "mol")
        {
            if (c.balance.molybdenum > 0) return c.balance.molybdenum;
        } else if (object === "megacredits" || object === "mcs")
        {
            if (c.balance.megacredits > 0 && module && module === "exp") return planet.megacredits - 100;
            if (c.balance.megacredits > 0) return c.balance.megacredits;
        } else if (object === "supplies" || object === "sup")
        {
            if (c.balance.supplies > 0) return c.balance.supplies;
        } else if (object === "minerals" || object === "all")
        {
            return autopilot.getMineralExcess(planet);
        }
        return 0;
    },
    getSumOfObjectsInRange: function(center, range)
    {
        var planets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, center.x, center.y, range);
        var objects = {
            base: center.id,
            name: center.name,
            range: range,
            planets: 0,
            mcs: 0,
            neu: 0,
            gneu: 0,
            dur: 0,
            gdur: 0,
            tri: 0,
            gtri: 0,
            mol: 0,
            gmol: 0,
            cla: 0,
            sup: 0
        };
        for (var i = 0; i < planets.length; i++)
        {
            var cP = vgap.getPlanet(planets[i].pid);
            objects.planets++;
            objects.mcs += cP.megacredits;
            objects.neu += cP.neutronium;
            objects.gneu += cP.groundneutronium;
            objects.dur += cP.duranium;
            objects.gdur += cP.groundduranium;
            objects.tri += cP.tritanium;
            objects.gtri += cP.groundtritanium;
            objects.mol += cP.molybdenum;
            objects.gmol += cP.groundmolybdenum;
            objects.cla += cP.clans;
            objects.sup += cP.supplies;
        }
        return objects;
    },
    getDeficienciesByPlanet: function()
    {
        autopilot.deficienciesByPlanet = {};
        return autopilot.deficienciesByPlanet;
    },
    collectSbBuildingData: function()
    {
        autopilot.sbDeficiencies = [];
        for (var i = 0; i < vgap.myplanets.length; i++)
        {
            var planet = vgap.myplanets[i];
            var pCfg = autopilot.planetIsInStorage(planet.id);
            if (pCfg.pMission === "bba")
            {
                var sbDef = autopilot.getBaseDeficiency(planet);
                autopilot.sbDeficiencies.push( { pid: planet.id, deficiencies: sbDef } );
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
    getMaxDefense: function(planet)
    {
        var maxPop = autopilot.getMaxColonistPopulation(planet);
        return Math.floor(Math.sqrt(maxPop - 50) + 50);
    },
    getCurrentMaxDefense: function(planet)
    {
        //console.log("...current maximal defense of planet " + planet.id + ": " + Math.floor(Math.sqrt(planet.clans - 50) + 50));
        return Math.floor(Math.sqrt(planet.clans - 50) + 50);
    },
    behaviourHasToChange: function(current, future)
    {
        return (current.shipFunction !== future.shipFunction || current.ooiPriority !== future.ooiPriority);
    },
    /*
     * processload: executed whenever a turn is loaded: either the current turn or
     * an older turn through time machine
     */
    processload: function() {
        console.log(vgap);
        // autopilot.scanReports();
        // Settings
        autopilot.loadGameSettings();
        //
        if (!autopilot.realTurn || autopilot.realTurn < vgap.game.turn || autopilot.gameId !== vgap.game.id)
        {
            autopilot.realTurn = vgap.game.turn; // this is the current turn
            autopilot.gameId = vgap.game.id; // toDo: ??
        }
        //
        if (autopilot.realTurn === vgap.game.turn) // only act, when we are in the present
        {
            autopilot.setupStorage(); // local storage setup
            autopilot.scanReports(); // check reports for destroyed vessels
            autopilot.populateFrnnCollections();
            autopilot.populateShipCollections();
            //
            autopilot.planetaryManagement(); // myplanets -> colony -> set build targets according to planet mineral values, build structures, set taxes, set resource balance (deficiency / request & excess)
            //autopilot.populateMineralMaxis(); // now included in planetaryManagement
            //
            // APSs initial setup
            var apsControl = autopilot.initializeAPScontrol(); // INITIAL PHASE
            //
            // APS that arrived at destination did unload their cargo...
            //
            //
            autopilot.planetaryManagement(); // e.g. update buildTargets & build ??
            autopilot.collectSbBuildingData();
            //
            // APS without destination need to determine potential destinations
            //
            apsControl.forEach(function(shipcontrol) {
                if (shipcontrol.hasToSetPotDes)
                {
                    console.warn("SET POTENTIAL DESTINATIONS: APS " + shipcontrol.ship.id);
                    shipcontrol.functionModule.setPotentialDestinations(shipcontrol); // PHASE 1
                }
            });
            //
            // APS with potential mission destinations now evaluate potential destinations and pick target(s)
            //
            apsControl.forEach(function(shipcontrol) {
                if (shipcontrol.potDest.length > 0)
                {
                    console.warn("SET MISSION DESTINATION: APS " + shipcontrol.ship.id);
                    shipcontrol.initAPScontrol(); // reload apsBy... collections
                    shipcontrol.setMissionDestination(); // PHASE 2
                }
                if (!shipcontrol.isIdle)
                {
                    console.warn("CONFIRM MISSION: APS " + shipcontrol.ship.id);
                    shipcontrol.confirmMission(); // PHASE 3
                    shipcontrol.updateNote();
                }
            });
            //
            // IDLE APS: retry setting and evaluating potential destinations as well as pick target
            //
            apsControl.forEach(function(shipcontrol) {
                // retry idle ships
                if (shipcontrol.isIdle)
                {
                    console.error("Retry idle ship " + shipcontrol.ship.id);
                    if (!shipcontrol.destination)
                    {
                        console.warn("SET POTENTIAL DESTINATIONS: APS " + shipcontrol.ship.id);
                        shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                        if (shipcontrol.potDest.length > 0)
                        {
                            console.warn("SET MISSION DESTINSTION: APS " + shipcontrol.ship.id);
                            shipcontrol.setMissionDestination();
                        }
                    }
                    if (!shipcontrol.isIdle)
                    {
                        console.warn("CONFIRM MISSION: APS " + shipcontrol.ship.id);
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
        console.log("LoadDashboard: plugin called.");
        var a = $("<ul></ul>").appendTo("#DashboardMenu");
        vgap.dash.addLeftMenuItem("nuPilot" + " »", function() {
            vgap.dash.showNuPilotDash();
        }, a);
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
        autopilot.towedShips = [];
        var i = 0;
        var s = [];
        for (i = 0; i < vgap.myships.length; i++)
        {
            s = vgap.myships[i];
            if (s.mission === 6 && autopilot.towedShips.indexOf(s.mission1target) === -1) autopilot.towedShips.push(s.mission1target);
        }
        for (i = 0; i < vgap.myships.length; i++)
        {
            s = vgap.myships[i];
            autopilot.shipIdleIndicator(s);
            autopilot.shipCloakIndicator(s);
            autopilot.shipRobbedIndicator(s);
            autopilot.shipRGAIndicator(s);
        }
        for (var j = 0; j < vgap.myplanets.length; j++)
        {
            var p = vgap.myplanets[j];
            autopilot.planetIdleIndicator(p);
        }
        autopilot.apsIndicators();
    },
    /**
     * Generate the content for the enemy ship dashboard tab
     * @param x			x coordinate of ship
     * @param y			y coordinate of ship
     * @param radius	radius of circle
     * @param attr		color of the drawing
     * @param paperset	where to draw
     * @param alpha     alpha value to use
     */
    drawSolidCircle : function(x, y, radius, attr, paperset, alpha) {
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.fillColor, alpha);
        paperset.beginPath();
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * 1.15, Math.PI * 1.15, false);
        paperset.lineTo(vgap.map.screenX(x), vgap.map.screenY(y));
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * 1.15, Math.PI * 1.35, false);
        paperset.lineTo(vgap.map.screenX(x), vgap.map.screenY(y));
        paperset.closePath();
        paperset.stroke();
        var org_fill_style = paperset.fillStyle;
        paperset.fillStyle = colorToRGBA(attr.fillColor, alpha);
        paperset.fill();
        //restore previous line width
        paperset.strokeStyle = org_stroke_style;
        paperset.fillStyle = org_fill_style;
    },
    drawScaledCircle : function(x, y, radius, attr, paperset, alpha) {
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        var org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        var org_dash_style = paperset.getLineDash();
        if (attr.lineDash) paperset.setLineDash(attr.lineDash);
        //paperset.setAlpha(0.5);
        paperset.beginPath();
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, 0, Math.PI * 2, false);
        paperset.stroke();
        //restore previous line width
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        paperset.lineCap = org_line_cap;
        paperset.setLineDash(org_dash_style);
    },
    drawVerticalLine : function(x, y, distance, zone, attr, paperset, alpha, partial, height)
    {
        if (distance <= 1) distance = 5;
        distance *= vgap.map.zoom;
        var zones = {
            ne: [distance, 0],
            se: [distance, -20],
            sw: [distance*-1, -20],
            nw: [distance*-1, 0]
        };
        var startX = vgap.map.screenX(x) + parseInt(zones[zone][0]);
        var startY = vgap.map.screenY(y) + parseInt(zones[zone][1]);
        //if (!vgap.map.isVisible(x, y, distance)) return;
        if (typeof partial === "undefined") partial = 1;
        height *= vgap.map.zoom;
        if (partial < 1) height = height * partial;
        //
        if (paperset === null)
            paperset = vgap.map.ctx;
        //
        //  save original attributes
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        var org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        var org_dash_style = paperset.getLineDash();
        if (attr.lineDash) paperset.setLineDash(attr.lineDash);
        //
        paperset.beginPath();
        paperset.moveTo(startX, startY);
        paperset.lineTo(startX, startY - height);
        paperset.stroke();
        //
        //  restore original attributes
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        paperset.lineCap = org_line_cap;
        paperset.setLineDash(org_dash_style);
    },
    drawHorizontalLine : function(x, y, yDist, zone, attr, paperset, alpha, partial, width)
    {
        if (yDist <= 1) yDist = 1;
        yDist *= vgap.map.zoom;
        width *= vgap.map.zoom;
        var xBaseDist = 5*vgap.map.zoom;
        var zones = {
            ne: [xBaseDist, yDist*-1],
            se: [xBaseDist, yDist],
            sw: [(width+xBaseDist)*-1, yDist],
            nw: [(width+xBaseDist)*-1, yDist*-1]
        };
        var startX = vgap.map.screenX(x) + parseInt(zones[zone][0]);
        var startY = vgap.map.screenY(y) + parseInt(zones[zone][1]);
        //if (!vgap.map.isVisible(x, y, distance)) return;
        if (typeof partial === "undefined") partial = 1;

        if (partial < 1) width = width * partial;
        //
        if (paperset === null)
            paperset = vgap.map.ctx;
        //
        //  save original attributes
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        var org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        var org_dash_style = paperset.getLineDash();
        if (attr.lineDash) paperset.setLineDash(attr.lineDash);
        //
        paperset.beginPath();
        paperset.moveTo(startX, startY);
        paperset.lineTo(startX + width, startY);
        paperset.stroke();
        //
        //  restore original attributes
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        paperset.lineCap = org_line_cap;
        paperset.setLineDash(org_dash_style);
    },
    drawFilledQuarterCircle : function(x, y, radius, zone, attr, paperset, alpha, partial, fillCol) {
        if (typeof partial === "undefined") partial = 1;
        if (typeof fillCol === "undefined") fillCol = "white";
        var zones = {
            ne: [1.5,2],
            se: [0,0.5],
            sw: [0.5,1],
            nw: [1,1.5]
        };
        if (partial < 1)
        {
            var newStartAngle = zones[zone][0] + (partial * 0.25); // increase start-angle
            var newEndAngle = zones[zone][1] - (partial * 0.25); // reduce end-angle
            zones[zone][0] = newStartAngle;
            zones[zone][1] = newEndAngle;
        }
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        var org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        var org_dash_style = paperset.getLineDash();
        if (attr.lineDash) paperset.setLineDash(attr.lineDash);
        //paperset.setAlpha(0.5);
        paperset.beginPath();
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * zones[zone][0], Math.PI * zones[zone][1], false);
        paperset.lineTo(vgap.map.screenX(x),vgap.map.screenY(y));
        paperset.closePath();
        paperset.lineWidth = 1;
        paperset.fillStyle = fillCol;
        if (fillCol) paperset.fill();
        paperset.strokeStyle = '#FFFFFF';
        paperset.stroke();
        //restore previous line width
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        paperset.lineCap = org_line_cap;
        //paperset.fillStyle = false;
        paperset.setLineDash(org_dash_style);
    },
    drawFilledCircle : function(x, y, radius, attr, paperset, alpha) {
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        //save original settings
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = 1;
        //
        for (var i = 0; i <= attr.lineWidth; i++)
        {
            paperset.beginPath();
            paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius + i, Math.PI * 0, Math.PI * 2, false);
            paperset.stroke();
        }

        if (attr.outline)
        {
            paperset.beginPath();
            paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius + attr.lineWidth, Math.PI * 0, Math.PI * 2, false);
            paperset.strokeStyle = colorToRGBA(attr.outlineStroke, alpha);
            paperset.stroke();
        }

        //restore previous line width
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        //paperset.fillStyle = false;
    },
    drawScaledQuarterCircle : function(x, y, radius, zone, attr, paperset, alpha, partial) {
        if (typeof partial === "undefined") partial = 1;
        var zones = {
            ne: [1.5,2],
            se: [0,0.5],
            sw: [0.5,1],
            nw: [1,1.5]
        };
        if (partial < 1) zones[zone][1] = zones[zone][0] + (partial * 0.5);
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        var org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        var org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        var org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        var org_dash_style = paperset.getLineDash();
        if (attr.lineDash) paperset.setLineDash(attr.lineDash);
        //paperset.setAlpha(0.5);
        paperset.beginPath();
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * zones[zone][0], Math.PI * zones[zone][1], false);
        paperset.stroke();
        //restore previous line width
        paperset.strokeStyle = org_stroke_style;
        paperset.lineWidth = org_line_width;
        paperset.lineCap = org_line_cap;
        paperset.setLineDash(org_dash_style);
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
        var c = new Colony(vgap.planetScreen.planet.id, false);
        console.log(c);
        //console.log("Planet id: " + vgap.planetScreen.planet.id);
        // toDo: is there a close planet screen hook? or a transfer ocurred hook?
        // It would be helpful to reinitialize (or update) APS which
        // - are at the planet (if resources / deficiencies / excess changed)
        // - have this planet as destination (if resources / deficiencies / excess changed)
        // - have this planet as next target (mainly because of fuel...)
    },
    /*
     * loadPlanet: executed when a planet is selected on dashboard or starmap
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
        if (apsData)
        {
            if (apsData.idle)
            {
                console.log("Ship idle status: " + apsData.idle);
                autopilot.setupAPS(vgap.shipScreen.ship.id, apsData);
            }
        }
    }
};/*
 *  Planet Object toDo: organize all planet related info here
 */
function Colony(pid, build)
{
    this.abrMoveables = {
        neu: "neutronium",
        dur: "duranium",
        tri: "tritanium",
        mol: "molybdenum",
        cla: "clans",
        sup: "supplies",
        mcs: "megacredits"
    };
    this.pid = pid;
    this.planet = vgap.getPlanet(pid);
    //
    if (!autopilot.planetIsInStorage(pid)) autopilot.syncLocalPlaneteerStorage({ pid: pid }); // make sure we have a default entry for the colony
    //
    this.hasStarbase = vgap.getStarbase(pid);
    this.isOwnPlanet = (this.planet && this.planet.ownerid === vgap.player.id); // only own planets are colonies
    this.isBuildingBase = this.isBuildingStarbase();
    this.isSellingSupply = this.isSellingSupply();
    this.isBuildingStructures = this.isBuildingStructures();
    this.isFort = this.isFortifying(pid); // a purely defensive base
    //
    this.isSink = false;
    this.isMineralSink = false;
    this.isFuelSink = false;
    this.isStructureSink = false;
    this.isColonistSink = false;
    //
    this.target = {
        clans: this.planet.clans,
        megacredits: this.planet.megacredits,
        supplies: this.planet.supplies,
        neutronium: this.planet.neutronium
    };
    this.popGrowthObstacle = [];
    this.curColPopGrowth = this.getColonistGrowth();
    this.curNatPopGrowth = this.getNativeGrowth();
    this.maxColPop = this.getMaxColPop();
    this.minColPop = this.getMinColPop(); // minimum for growth
    this.squeezeColPop = this.getSqueezeColPop(); // population to be able to squeeze max (max. 5000)
    this.maxNatPop = this.getMaxNatPop();
    this.revenue = this.getRevenue();
    this.maxIncome = 5000;
    this.optNatTaxClans = this.getOptNatTaxClans();
    this.optBovSupClans = this.getOptBovSupClans();
    this.hasTecRace = this.nativesAreTecRace();
    // manage source and sink in one!!!
    this.balance = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0,
        supplies: 0,
        megacredits: 0,
        clans: 0
    };
    this.minerals = ["neutronium","duranium","tritanium","molybdenum"];
    this.mineralProduction = this.getMineralProduction();
    this.structures = this.getStructures();
    this.mineralDepletions = false;
    this.meanMineralDepletion = false;
    //
    if (typeof build === "undefined") build = false;
    //
    if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.setBuildTargets();
    this.optLabor = this.getOptLabor();
    if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildStructures();
    if (autopilot.settings.planetMNG && build && this.isSellingSupply) this.sellSupply();
    this.setMeanMineralDepletion(); // independent of this.mineralProduction
    //
    if (autopilot.settings.planetMNG) this.setTaxes();
    this.initializeBalance();
    this.collectorMinerals = this.balance.duranium+this.balance.tritanium+this.balance.molybdenum;
    this.mineralRequest = false;
    this.distributorCargo = this.getDistributorCargo();
    this.setTransitFuelRequest();
    //
    if (vgap.map.canvas) this.drawIndicators(); // INDICATORS
}
/*
    AUTORUN
 */
Colony.prototype.initializeBalance = function()
{
    this.balance.supplies = this.getSupplyDeficiency(); // needs to be calculated before megacredits, since supplies can be transformed to MCs
    this.balance.megacredits = this.getMcDeficiency();
    this.balance.clans = this.getClanDeficiency();
    this.balance.neutronium = this.getFuelDeficiency();
    this.setPlanetMineralExcess();
    //
    if (this.hasStarbase)
    {
        this.setStarbaseDeficiency();
    } else if (this.isBuildingBase)
    {
        this.setBaseDeficiency();
    }
    if (this.isFort) // planets with or without starbase but set to fortify
    {
        this.setFortMineralExcess();
    }
    if (this.balance.duranium < 0 || this.balance.tritanium < 0 || this.balance.molybdenum < 0)
    {
        this.isSink = true;
        this.isMineralSink = true;
        this.mineralRequest = 0;
        if (this.balance.duranium < 0) this.mineralRequest -= this.balance.duranium;
        if (this.balance.tritanium < 0) this.mineralRequest -= this.balance.tritanium;
        if (this.balance.molybdenum < 0) this.mineralRequest -= this.balance.molybdenum;
    }
};
Colony.prototype.drawIndicators = function()
{
    var p = this.planet;
    if (this.hasStarbase || this.isBuildingBase) this.drawStarbaseIndicators(); // map indicator
    if (this.isFort) this.drawFortIndicators();
    this.drawMineralValueIndicator();
    this.drawNativeIndicators();
};
/*
    MINERALS, FUEL and SUPPLY
 */
Colony.prototype.setPlanetMineralExcess = function()
{
    var p = this.planet;
    this.balance.duranium += p.duranium;
    this.balance.tritanium += p.tritanium;
    this.balance.molybdenum += p.molybdenum;
};
Colony.prototype.setFortMineralExcess = function()
{
    var p = this.planet;
    // hold back at least 100 of each building mineral
    if (this.balance.duranium === 0 && p.duranium !== 0) this.balance.duranium = p.duranium - 100;
    if (this.balance.tritanium === 0 && p.tritanium !== 0) this.balance.tritanium += p.tritanium - 100;
    if (this.balance.molybdenum === 0 && p.molybdenum !== 0) this.balance.molybdenum += p.molybdenum - 100;
};
Colony.prototype.getFuturePlanetResources = function(turns)
{
    var p = this.planet;
    if (typeof turns === "undefined") turns = 1;
    //
    var mines = parseInt(p.mines);
    var factories = parseInt(p.factories);
    var supplies = parseInt(p.supplies);
    //
    var neu = parseInt(p.neutronium);
    var gneu = parseInt(p.groundneutronium);
    var dneu = parseInt(p.densityneutronium);
    var theoNeu = Math.floor((dneu / 100) * mines) * turns;
    var actNeu = theoNeu + neu;
    if (theoNeu > gneu) actNeu = gneu + neu;
    //
    var dur = parseInt(p.duranium);
    var gdur = parseInt(p.groundduranium);
    var ddur = parseInt(p.densityduranium);
    var theoDur = Math.floor((ddur / 100) * mines) * turns;
    var actDur = theoDur + dur;
    if (theoDur > gdur) actDur = gdur + dur;
    //
    var tri = parseInt(p.tritanium);
    var gtri = parseInt(p.groundtritanium);
    var dtri = parseInt(p.densitytritanium);
    var theoTri = Math.floor((dtri / 100) * mines) * turns;
    var actTri = theoTri + tri;
    if (theoTri > gtri) actTri = gtri + tri;
    //
    var mol = parseInt(p.molybdenum);
    var gmol = parseInt(p.groundmolybdenum);
    var dmol = parseInt(p.densitymolybdenum);
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
Colony.prototype.setTargetNeutronium = function()
{
    var p = this.planet;
    var target = autopilot.settings.defNeuRetention; // default
    if (this.hasStarbase) target += autopilot.settings.sbNeuRetention;
    if (this.isFort) target += autopilot.settings.frtNeuRetention;

    var alchemyAtPlanet = autopilot.alchemyAtPlanet(p);
    if (alchemyAtPlanet)
    {
        target += 400;
    }
    var apsIdleFuel = autopilot.getIdleAPSfuelDeficiency(p);
    if (apsIdleFuel)
    {
        target += apsIdleFuel;
    }
    var nonApsFuel = autopilot.getNonAPSfuelDeficiency(p);
    if (nonApsFuel)
    {
        target += nonApsFuel;
    }
    this.target.neutronium = target;
};
Colony.prototype.getFuelDeficiency = function()
{
    var p = this.planet;
    this.setTargetNeutronium();
    var deficiency = p.neutronium + this.getMineralOutput("neutronium") - this.target.neutronium;
    if (deficiency > 0) deficiency -= this.getMineralOutput("neutronium");
    if (deficiency < 0)
    {
        this.isSink = true;
        this.isFuelSink = true;
    }
    return Math.floor(deficiency);
};
Colony.prototype.setTargetSupplies = function()
{
    var p = this.planet;
    var s = this.getStructures();
    var target = autopilot.settings.defSupRetention; // retain x supplies on planet
    var sB = vgap.getStarbase(p.id);
    if (sB && !this.isFort) target += autopilot.settings.sbSupRetention; // retain x more supplies on planet if sb is present
    if (vgap.player.raceid === 10 || vgap.player.raceid === 11) target += 150; // fighter producing races
    if (autopilot.refineryAtPlanet(p)) target += 1050;
    if (autopilot.alchemyAtPlanet(p)) target += 2700;
    target += (s.factories.def * 3);
    target += (s.mines.def * 4);
    target += (s.defense.def * 10);
    this.target.supplies = target;
};
Colony.prototype.getSupplyDeficiency = function()
{
    var p = this.planet;
    this.setTargetSupplies();
    var deficiency = p.supplies + p.factories - this.target.supplies;
    if (deficiency > 0) {
        deficiency -= p.factories;
    }
    if (deficiency < 0)
    {
        this.isSink = true;
        this.isStructureSink = true;
    }
    return deficiency;
};
Colony.prototype.setTransitFuelRequest = function()
{
    // check if ships are at planet...
    // For each ship, we request the amount necessary to fly to the closest neighbor planet.
    var p = this.planet;
    var ships = vgap.shipsAt(p.x, p.y);
    var closest = autopilot.getClosestPlanet({ x: p.x, y: p.y});
    if (closest)
    {
        for (var i = 0; i < ships.length; i++)
        {
            if (ships[i].ownerid !== vgap.player.id) continue;
            var cS = ships[i];
            var cRequest = Math.floor(autopilot.getOptimalFuelConsumptionEstimate(cS.id, [], closest.distance));
            //console.log(cRequest);
            var isAPS = autopilot.isInStorage(cS.id);
            if (isAPS)
            {
                // toDo: In case of APS we use the required amount to get back to base (all types except distributors).
                //
                this.balance.neutronium -= cRequest;
            } else
            {
                this.balance.neutronium -= cRequest;
            }
        }
    }
};
Colony.prototype.setMineralProduction = function()
{
    this.mineralProduction = this.getMineralProduction();
};
Colony.prototype.getMineralProduction = function(mines)
{
    if (typeof mines === "undefined") mines = this.planet.mines;
    var m = this.minerals;
    var production = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    for(var i = 0; i < m.length; i++)
    {
        production[m[i]] = this.getMineralOutput(m[i], mines);
    }
    return production;
};
Colony.prototype.getMineralOutput = function(mineral, mines)
{
    var p = this.planet;
    if (typeof mines === "undefined") mines = p.mines;
    if (vgap.player.raceid === 2 || p.nativeracename === "Reptilians")  mines *= 2;
    var theo = Math.round( (parseInt(p["density" + mineral]) / 100) * mines );
    var ground = parseInt(p["ground" + mineral]);
    if (ground >= theo) return theo;
    return ground;
};
Colony.prototype.getMineralStats = function()
{
    var p = this.planet;
    var sumAll = p.groundneutronium + p.groundduranium + p.groundtritanium + p.groundmolybdenum;
    var sumBld = p.groundduranium + p.groundtritanium + p.groundmolybdenum;
    var sumTop = p.groundduranium + p.groundmolybdenum;
    var TopBld = Math.round((sumTop / sumBld) * 100); // x 100 = x % of build minerals are rare minerals
    var TopAll = Math.round((sumTop / sumAll) * 100); // x 100 = x % of all minerals are rare minerals
    return {
        sumAll: sumAll,
        sumBld: sumBld,
        sumTop: sumTop,
        topBld: TopBld,
        topAll: TopAll
    };
};
Colony.prototype.getDepletionTurns = function(mineral, mines)
{
    if (typeof mines === "undefined") mines = this.planet.mines;
    var extraction = this.getMineralOutput(mineral, mines);
    return Math.floor(parseInt(this.planet["ground" + mineral]) / extraction);
};
Colony.prototype.setMeanMineralDepletion = function(types)
{
    if (typeof types === "undefined") types = autopilot.minerals;
    if (!this.mineralDepletions) this.setMineralDepletions();
    var depletion = 0;
    for (var i = 0; i < this.mineralDepletions.length; i++)
    {
        if (types.indexOf(this.mineralDepletions[i].mineral) > -1) depletion += this.mineralDepletions[i].turns;
    }
    this.meanMineralDepletion = Math.round(depletion / types.length);
};
Colony.prototype.getMeanMineralDepletion = function(types)
{
    this.setMeanMineralDepletion(types);
    return this.meanMineralDepletion;
};
Colony.prototype.setMineralDepletions = function()
{
    var p = this.planet;
    // return object with minerals and turns till depletion and remaining ground mineral
    var data = [];
    for (var i = 0; i < this.minerals.length; i++)
    {
        var deplTurns = this.getDepletionTurns(this.minerals[i]);
        var diff = p.mines - p.targetmines;
        data.push({ mineral: this.minerals[i], turns: deplTurns, remaining: p["ground" + this.minerals[i]], mines: diff});
    }
    data.sort(
        function(a, b)
        {
            var x = a.turns;
            var y = b.turns;
            if (x < y) {return 1;}
            if (x > y) {return -1;}
            return 0;
        }
    );
    this.mineralDepletions = data;
};
Colony.prototype.getSumOfAllMinerals = function()
{
    var p = this.planet;
    return p.neutronium+p.duranium+p.tritanium+p.molybdenum+p.groundneutronium+p.groundduranium+p.groundtritanium+p.groundmolybdenum;
};
Colony.prototype.sellSupply = function()
{
    var p = this.planet;
    var available = this.getSupplyDeficiency();
    if (available <= 0) return false;
    if (this.isSellingSupply)
    {
        p.supplies -= available;
        p.suppliessold += available;
        p.megacredits += available;
        p.changed = 1;
    }
};
/*
    STRUCTURES (planetary & orbital)
 */
Colony.prototype.updateStructures = function()
{
    this.structures = this.getStructures();
};
Colony.prototype.getStructures = function()
{
    var p = this.planet;
    // Mines
    var mM = this.getMaxMines();
    var mDef = 0;
    if (p.targetmines > p.mines) mDef = p.targetmines - p.mines;
    var mP = this.getMineralProduction(p.mines);
    // Factories
    var mF = this.getMaxFactories();
    var fDef = 0;
    if (p.targetfactories > p.factories) fDef = p.targetfactories - p.factories;
    // Defense
    var mD = this.getMaxDefense();
    var dDef = 0;
    if (p.targetdefense > p.defense) dDef = p.targetdefense - p.defense;
    //
    return {
        factories: {
            now: p.factories,
            target: p.targetfactories,
            def: fDef,
            max: mF.max,
            maxNow: mF.maxNow,
            production: p.factories
        },
        mines: {
            now: p.mines,
            target: p.targetmines,
            def: mDef,
            max: mM.max,
            maxNow: mM.maxNow,
            production: mP
        },
        defense: {
            now: p.defense,
            target: p.targetdefense,
            def: dDef,
            max: mD.max,
            maxNow: mD.maxNow,
            production: false
        }
    };
};
Colony.prototype.getMaxMines = function()
{
    var p = this.planet;
    var maxMines = 0;
    if (this.maxColPop >= 200)
    {
        maxMines = 200 + Math.sqrt(this.maxColPop - 200);
    } else
    {
        maxMines = this.maxColPop;
    }
    var mM = Math.floor(parseInt(maxMines));
    if (p.clans >= 200)
    {
        maxMines = 200 + Math.sqrt(p.clans - 200);
    } else
    {
        maxMines = p.clans;
    }
    return { max: mM, maxNow: Math.floor(maxMines) };
};
Colony.prototype.getMaxFactories = function()
{
    var p = this.planet;
    var maxFact = 0;
    if (this.maxColPop >= 100)
    {
        maxFact = 100 + Math.sqrt(this.maxColPop - 100);
    } else
    {
        maxFact = this.maxColPop;
    }
    var mF = Math.floor(parseInt(maxFact));
    if (p.clans >= 100)
    {
        maxFact = 100 + Math.sqrt(p.clans - 100);
    } else
    {
        maxFact = p.clans;
    }
    return { max: mF, maxNow: Math.floor(maxFact) };
};
Colony.prototype.getMaxDefense = function()
{
    var p = this.planet;
    var maxDefe = 0;
    if (this.maxColPop >= 50)
    {
        maxDefe = 50 + Math.sqrt(this.maxColPop - 50);
    } else
    {
        maxDefe = this.maxColPop;
    }
    var mD = Math.floor(parseInt(maxDefe));
    if (p.clans >= 50)
    {
        maxDefe = 50 + Math.sqrt(p.clans - 50);
    } else
    {
        maxDefe = p.clans;
    }
    return { max: mD, maxNow: Math.floor(maxDefe) };
};
Colony.prototype.setBuildTargets = function()
{
    if (this.isOwnPlanet)
    {
        this.updateStructures();
        // Mines
        this.adjustTargetMines();
        // Factories
        this.adjustTargetFactories();
        // Defense
        this.adjustTargetDefense();
    }
};
Colony.prototype.adjustTargetMines = function()
{
    var p = this.planet;
    var sF = this.structures.factories;
    var sM = this.structures.mines;
    if (sM.def === 0)
    {
        p.targetmines = 0; // reset
        var stats = this.getMineralStats(); // ground minerals
        if (p.factories >= 50 || p.factories >= sF.maxNow)
        {
            if (stats.sumAll > 250 && p.mines < 50)
            {
                if (sM.maxNow >= 50)
                {
                    p.targetmines = 50;
                } else
                {
                    p.targetmines = sM.maxNow;
                }
            } else
            {
                //console.log("Planet " + p.id + " is depleted... Mines: " + p.mines + " Minerals: " + stats.sumAll);
            }
        }
        // special cases:
        // - do not use maxNow as limit. Thus will result in population demand for builders or local collectors
        var specialCase = false;
        autopilot.minerals.forEach(function (m) {
            var threeQ = autopilot.getKpercentileThresh(autopilot.globalMinerals.ground.values[m], 75);
            if (p["ground" + m] >= threeQ)
            {
                specialCase = m;
            }
        });
        if (specialCase && (p.factories >= 50 || p.factories === sF.maxNow))
        {
            var depletion = this.getMeanMineralDepletion([ specialCase ]);
            if (p.mines === 0)
            {
                if (sM.maxNow >= 50)
                {
                    p.targetmines = 50;
                } else
                {
                    p.targetmines = sM.maxNow;
                }
            }
            if (p.mines >= 50)
            {
                if (depletion > 25)
                {
                    // toDo: only if the resource is in high demand (e.g. if its the one that is the most scarce in a certain radius)
                    p.targetmines = p.mines + 25;
                } else
                {
                    p.targetmines = p.mines + 10;
                }
            }
        }
        this.updateStructures();
    }
};
Colony.prototype.adjustTargetFactories = function()
{
    var p = this.planet;
    var f = p.factories;
    var sF = this.structures.factories;
    if (sF.def === 0)
    {
        p.targetfactories = 0; // reset
        if (f < 10)
        {
            p.targetfactories = 10;
            if (p.supplies >= 50) p.targetfactories = 50;
        } else
        {
            // build 10 more factories each round up to 100 final
            if (sF.maxNow < 50 && f < sF.maxNow)
            {
                p.targetfactories = sF.maxNow;
            } else if (sF.maxNow >= 50 && f < 50)
            {
                p.targetfactories = 50;
            } else if (sF.maxNow >= 100 && f < 100)
            {
                if ((f + 10) < 100)
                {
                    p.targetfactories = f + 10;
                } else
                {
                    p.targetfactories = 100;
                }
            }
        }
        this.updateStructures();
    }
};
Colony.prototype.adjustTargetDefense = function()
{
    var p = this.planet;
    var sD = this.structures.defense;
    var sF = this.structures.factories;
    var sM = this.structures.mines;
    var defaultDefense = autopilot.settings.defPlanetDef;
    if (sD.def === 0 && sF.def === 0 && (p.factories >= 50 || p.factories >= sF.maxNow) && sM.def === 0 && (p.mines >= 50 || p.mines >= sM.maxNow))
    {
        p.targetdefense = 0; // reset
        if (this.hasStarbase)
        {
            defaultDefense += autopilot.settings.defPlanetSbDef;
        }
        if (this.isFort)
        {
            defaultDefense += autopilot.settings.defPlanetFortDef;
        }
        if (sD.max >= defaultDefense)
        {
            if (p.defense < defaultDefense && sD.max >= defaultDefense)
            {
                p.targetdefense = defaultDefense;
            }
        } else
        {
            if (this.isFort)
            {
                p.targetdefense = Math.floor(sD.max * 0.95); // only set to 95 % of maximum defense, reserves population for distribution / development of planets
            } else
            {
                p.targetdefense = Math.floor(sD.max * 0.90); // only set to 90 % of maximum defense, reserves population for distribution / development of planets
            }
        }
        this.updateStructures();
    }
};
Colony.prototype.buildFactories = function(n)
{
    var p = this.planet;
    var cost = {
        supplies: 1,
        megacredits: 3
    };
    var sF = this.structures.factories;
    for (var i = 0; i < n; i++)
    {
        if (p.supplies >= cost.supplies && p.megacredits >= cost.megacredits && p.factories < sF.maxNow)
        {
            p.supplies -= cost.supplies;
            p.megacredits -= cost.megacredits;
            p.factories += 1;
            p.builtfactories += 1;
        }
    }
};
Colony.prototype.buildMines = function(n)
{
    var p = this.planet;
    var cost = {
        supplies: 1,
        megacredits: 4
    };
    var sM = this.structures.mines;
    for (var i = 0; i < n; i++)
    {
        if (p.supplies >= cost.supplies && p.megacredits >= cost.megacredits && p.mines < sM.maxNow)
        {
            p.supplies -= cost.supplies;
            p.megacredits -= cost.megacredits;
            p.mines += 1;
            p.builtmines += 1;
        }
    }
};
Colony.prototype.buildDefense = function(n)
{
    var p = this.planet;
    var cost = {
        supplies: 1,
        megacredits: 10
    };
    var sD = this.structures.defense;
    for (var i = 0; i < n; i++)
    {
        if (p.supplies >= cost.supplies && p.megacredits >= cost.megacredits && p.defense < sD.maxNow)
        {
            p.supplies -= cost.supplies;
            p.megacredits -= cost.megacredits;
            p.defense += 1;
            p.builtdefense += 1;
        }
    }
};
Colony.prototype.buildStructures = function()
{
    if (this.isOwnPlanet)
    {
        // Factories
        var fS = this.structures.factories;
        if (fS.def > 0) this.buildFactories(fS.def);
        // Mines
        var mS = this.structures.mines;
        if (mS.def > 0) this.buildMines(mS.def);
        // Defense
        var dS = this.structures.defense;
        if (dS.def > 0) this.buildDefense(dS.def);
    }
};
Colony.prototype.getMinesForDepletion = function(mineral, turns)
{
    var density = this.planet["density" + mineral] / 100;
    var deposits = this.planet["ground" + mineral];
    // mines * densNeu = depletionTurns / this.planet.groundneutronium;
    //console.log("There are " + deposits + "kt (" + density + " density) of " + mineral + " in the ground!");
    var mines = Math.floor((deposits / turns) / density);
    //console.log("With " + mines + " mines (" + density + " * " + (deposits / turns) + "), kt of " + mineral + " in ground");
    return mines;
};
Colony.prototype.setStarbaseProduction = function()
{
    var p = this.planet;
    var sb = this.hasStarbase;
    var sbD = {
        megacredits: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    //
    if (sb.enginetechlevel > 8 && sb.hulltechlevel > 9)
    {
        // set required minerals for capital ship production
        if (sb.beamtechlevel > 4 && (vgap.player.raceid === 10 || vgap.player.raceid === 11)) // rebels (10), colonies (11)
        {
            // carrier production
        } else if (sb.beamtechlevel > 4 && sb.torptechlevel > 4 && (vgap.player.raceid === 1 || vgap.player.raceid === 3 || vgap.player.raceid === 2))  // fed (1), birds (3), lizards (7)
        {
            // torp race
            if (vgap.player.raceid === 2)
            {
                // t-rex
                sbD.megacredits += 350;
                sbD.duranium += 140;
                sbD.tritanium += 153;
                sbD.molybdenum += 100;
            }
        }
    } else if (sb.enginetechlevel > 8 && sb.hulltechlevel > 5)
    {
        // set required minerals for LDSF, medium ship production
        sbD.megacredits += 760;
        sbD.duranium += 117;
        sbD.tritanium += 13;
        sbD.molybdenum += 78;
        // toDo: add tranquilly, patriot cost for rebells & colonies
        // toDo: add resolute cost for birds
    } else if (sb.enginetechlevel > 8 && sb.hulltechlevel > 2)
    {
        // set required minerals for MDSF + NFC production
        sbD.megacredits += 365 + 620;
        sbD.duranium += 20 + 42;
        sbD.tritanium += 7 + 8;
        sbD.molybdenum += 41 + 90;
        // toDo: add cobol class research (colos)
    }
    var minPro = this.mineralProduction;
    if (sbD.duranium > minPro.duranium)
    {
        this.balance.duranium -= (sbD.duranium - minPro.duranium);
    }
    if (sbD.tritanium > minPro.tritanium)
    {
        this.balance.tritanium -= (sbD.tritanium - minPro.tritanium);
    }
    if (sbD.molybdenum > minPro.molybdenum)
    {
        this.balance.molybdenum -= (sbD.molybdenum - minPro.molybdenum);
    }
    if (sbD.megacredits > this.getRevenue())
    {
        this.balance.megacredits -= (sbD.megacredits - this.getRevenue());
    }
};
Colony.prototype.setStarbaseDeficiency = function()
{
    var p = this.planet;
    var sb = this.hasStarbase;
    var tecLvl = [];
    var sbD = {
        megacredits: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    var torpCost = [0,1,2,5,10,12,13,31,35,36,54];  // cost per torp by tec level
    //
    var minSbFighter = autopilot.settings.minSbFighter; // Each base should be defended by at least 20 fighter
    var minSbDefense = autopilot.settings.minSbDefense; // Each base should be defended by at least 50 sb defense posts

    //
    // ship production, torpedo production
    //
    if (this.isFort)
    {
        minSbFighter = 60; // maximize fighter defense
        minSbDefense = 200; // maximize defense posts
        tecLvl = [
            {
                name: "beam",
                demand: 10
            }
        ];
        // torpedo building backup (100 with max available torp tec)
        sbD.megacredits += 100 * torpCost[sb.torptechlevel];
    } else
    {
        tecLvl = [
            {
                name: "hull",
                demand: 10
            },
            {
                name: "engine",
                demand: 10
            },
            {
                name: "beam",
                demand: 10
            },
            {
                name: "torp",
                demand: 10
            }
        ];
        this.setStarbaseProduction();
    }

    tecLvl.forEach(
        function (tec, index) {
            sbD.megacredits += autopilot.getTechDeficiency(sb[tec.name+"techlevel"],tec.demand);
        }
    );

    // Starbase Defense (Fighter)
    sbD.tritanium += (minSbFighter - sb.fighters) * 3;
    sbD.molybdenum += (minSbFighter - sb.fighters) * 2;
    sbD.megacredits += (minSbFighter - sb.fighters) * 100;
    // Starbase Defense (Defense Posts)
    sbD.duranium += (minSbDefense - sb.defense);
    sbD.megacredits += (minSbDefense - sb.defense) * 10;
    //
    var minPro = this.mineralProduction;
    if (sbD.duranium > minPro.duranium)
    {
        this.balance.duranium -= (sbD.duranium - minPro.duranium);
    }
    if (sbD.tritanium > minPro.tritanium)
    {
        this.balance.tritanium -= (sbD.tritanium - minPro.tritanium);
    }
    if (sbD.molybdenum > minPro.molybdenum)
    {
        this.balance.molybdenum -= (sbD.molybdenum - minPro.molybdenum);
    }
    if (sbD.megacredits > this.getRevenue())
    {
        this.balance.megacredits -= (sbD.megacredits - this.getRevenue());
    }
};
/*
    POPULATIONS, TAXES and MEGACREDITS
 */
Colony.prototype.getRevenue = function()
{
    return Math.floor(this.getIncomeFromNatives() + this.getIncomeFromColonists());
};
Colony.prototype.setTargetMegacredits = function()
{
    var s = this.getStructures();
    var target = autopilot.settings.defMcsRetention; // default minimum amount at planet
    target += (s.factories.def * 3);
    target += (s.mines.def * 4);
    target += (s.defense.def * 10);
    if (this.hasStarbase) target += autopilot.settings.sbMcsRetention; // default minimum amount at starbases
    this.target.megacredits = target;
};
Colony.prototype.getMcDeficiency = function()
{
    this.setTargetMegacredits();
    var p = this.planet;
    var deficiency = p.megacredits + this.getRevenue() - this.target.megacredits;
    if (deficiency > 0) deficiency -= this.getRevenue();
    if (deficiency < 0)
    {
        if (this.balance.supplies > 0) deficiency += this.balance.supplies;
        if (deficiency < 0) this.isSink = true;
        //this.isStructureSink = true;
    }
    return deficiency;
};
Colony.prototype.setTaxes = function()
{
    //console.log("APP: Setting taxes...")
    var p = this.planet;
    if (this.isSqueezingPopulations()) this.squeezeTaxes(); // colonists and natives
    if (this.isDoomed()) p.colonisttaxrate = 100;
    if (this.isDoomed() && p.nativeclans > 0 && p.nativeracename !== "Amorphous") p.nativetaxrate = 100;
    if (this.isTaxingByDefault()) this.setDefaultTaxrate();
    if (this.isTaxing4Growth()) this.setGrowthTaxrate();
};
//  NATIVES
Colony.prototype.getNativeGrowth = function(taxrate)
{
    var p = this.planet;
    if (typeof taxrate === "undefined") taxrate = p.nativetaxrate;
    var growth = 0;
    var growthModifier = 1;
    if (p.nativeclans < 1) return 0;
    if (p.nativehappypoints < 70) return 0;
    if (p.nativeclans >= this.maxNatPop) return 0;
    if (p.nativeclans > 66000) growthModifier = 0.5;

    if (p.nativeracename === "Siliconoids")
    {
        growth = growthModifier * (p.temp / 100) * (p.nativeclans / 20) * (5 / (taxrate + 5));
    } else
    {
        growth = growthModifier * Math.round( Math.sin(3.14 * (100 - p.temp) / 100) * (p.nativeclans / 25) * (5 / taxrate + 5) );
    }
    return growth;
};
Colony.prototype.getMaxNatPop = function()
{
    var p = this.planet;
    if (p.nativeclans < 1) return 0;
    if (p.nativeracename === "Siliconoids")
    {
        return p.temp * 1000; // like crystals
    } else
    {
        return Math.round( Math.sin(3.14 * (100 - p.temp) / 100) * 150000 );
    }
};
Colony.prototype.getOptNatTaxClans = function(taxrate)
{
    // return the number of clans needed to receive all native taxes
    if (typeof taxrate === "undefined") taxrate = this.getMaxHappyNativeTaxRate();
    return Math.ceil(this.getIncomeFromNatives(taxrate));
};
Colony.prototype.getNativeHappinessChange = function(taxrate) // returns -/0/+ amount of happynesspoints = change in happiness using taxrate
{
    var p = this.planet;
    var nativeRaceBonus = p.nativeracename === "Avian" ? 10 : 0;
    var nebulaBonus = 0; // toDo: get nebulaBonus // The Nebula Bonus is 5 if the planet is in a nebula and has less than 50 light-years visibility.
    var addHappyness = 0;
    if (vgap.player.raceid === 2) // Lizards
    {
        var ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0)
        {
            ships.forEach(function (s) {
                if (s.mission === 8) addHappyness += 5; // Hisssss
            });
        }
    }
    return addHappyness + (Math.round( (1000 - Math.sqrt(p.nativeclans) - 85 * taxrate - Math.round( (p.mines + p.factories) / 2 ) - 50 * (10 - p.nativegovernment)) ) / 100) + nativeRaceBonus + nebulaBonus;
};
Colony.prototype.getMaxHappyNativeTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (var i=50; i>0; i--)
    {
        var happinessChange = this.getNativeHappinessChange(i);
        if (happinessChange > -1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMinHappyNativeTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (var i = 1; i < 50; i++)
    {
        var happinessChange = this.getNativeHappinessChange(i);
        if (happinessChange < 1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMaxIncomeFromNatives = function()
{
    var p = this.planet;
    if (p.nativeclans > 0)
    {
        var taxrate = 100;
        var income = this.getIncomeFromNatives(taxrate);
        if (income > 5000) return 5000;
        return Math.ceil(income);
    } else {
        return 0;
    }
};
Colony.prototype.getIncomeFromNatives = function(taxRate)
{
    var p = this.planet;
    // Taxes = (Native Clans) * (Native Tax Rate) * (Planet Tax Efficiency=Native Government / 5) / 10
    if (typeof taxRate === "undefined") taxRate = p.nativetaxrate;
    if (p.nativeclans > 0) {
        var race = autopilot.ownerForPlanet(p);
        if (race === 6) if (taxRate > 20) taxRate = 20;
        var income = p.nativeclans * (taxRate / 100) * (p.nativegovernment / 5) / 10;
        if (p.nativeracename === "Insectoid") income *= 2;
        if (race === 1) income *= 2;
        if (race === 12) income = p.nativeclans;
        if (income > this.MaxIncome) income = this.MaxIncome;
        if (race !== 12 && p.nativeracename === "Amorphous") income = 0;
        if (race === 12 && p.nativeracename === "Siliconoid") income = 0;
        return income;
    }
    return 0;
};
Colony.prototype.nativesAreTecRace = function()
{
    var p = this.planet;
    return (p.nativeracename === "Ghipsoldal" ||
        p.nativeracename === "Amphibian" ||
        p.nativeracename === "Humanoid" ||
        p.nativeracename === "Siliconoid");
};
//  COLONISTS
Colony.prototype.getMaxColPop = function()
{
    var p = this.planet;
    if (p.temp > -1)
    {
        var race = autopilot.ownerForPlanet(p);
        if (race === 7) // crystalline
        {
            return (p.temp * 1000);
        } else if (p.temp > 84 && (race === 4 || race === 9 || race === 10 || race === 11)) // desert worlds // toDo: this is usually > 80, but seems wrong
        {
            return 60;
        } else if (p.temp > 84) // desert worlds
        {
            return Math.round( ( 20099.9 - (200 * p.temp) ) / 10 );
        } else if (p.temp < 19 && race === 10) // arctic worlds
        {
            return 90000;
        } else if (p.temp < 15) // arctic worlds
        {
            return Math.round( ( 299.9 + (200 * p.temp) ) / 10 );
        } else // temperate worlds
        {
            return Math.round(Math.sin(3.14 * (100 - p.temp) / 100 ) * 100000);
        }
    }
    return null;
};
Colony.prototype.getColonistGrowth = function(taxrate)
{
    var p = this.planet;
    if (typeof taxrate === "undefined") taxrate = p.colonisttaxrate;
    var growthModifier = 1;
    var race = autopilot.ownerForPlanet(p);
    if (p.temp > 15 && (p.temp < 84 || race === 7))
    {
        if (p.colonisthappypoints < 70)
        {
            this.popGrowthObstacle.push("colMood");
            return 0;
        }
        if (p.clans > 66000)
        {
            growthModifier = 0.5;
        }
        var tempFactor = Math.sin(Math.PI * ((100 - p.temp) / 100));
        var clanFactor = p.clans / 20;
        var taxFactor = 5 / (taxrate + 5);
        // console.log({ tempFactor: tempFactor, clanFactor: clanFactor, taxFactor: taxFactor});
        var curGrowth = growthModifier * Math.round( tempFactor * clanFactor * taxFactor );
        if (curGrowth === 0)
        {
            if (taxrate > 5)
            {
                this.popGrowthObstacle.push("taxRate");
            }
            if (p.clans < 20)
            {
                this.popGrowthObstacle.push("popSize");
            }
        }
        return curGrowth;
    } else
    {
        if (p.temp <= 15)
        {
            this.popGrowthObstacle.push("coldClimate");
        } else
        {
            this.popGrowthObstacle.push("hotClimate");
        }
    }
    return 0;
};
Colony.prototype.getSqueezeColPop = function()
{
    return this.getMaxIncomeFromNatives();
};
Colony.prototype.getMinColPop = function()
{
    var p = this.planet;
    // check minimum colonist population to achieve population growth under current circumstances (ignores happiness!)
    var race = autopilot.ownerForPlanet(p);
    var startClans = 1;
    var tempFactor = Math.sin(Math.PI * ((100 - p.temp) / 100));
    if (race === 7) tempFactor = p.temp / 100; // crystalline
    var clanFactor = startClans / 20;
    var taxFactor = 5 / (p.colonisttaxrate + 5);
    var growthClans = Math.round( tempFactor * clanFactor * taxFactor );
    var addClans = 1;
    while (growthClans < 1)
    {
        if (addClans > 100) break;
        clanFactor = (startClans + addClans) / 20;
        growthClans = Math.round( tempFactor * clanFactor * taxFactor );
        addClans++;
    }
    if (growthClans > 0)
    {
        return Math.round((startClans + addClans) * 1.05); // + 5% as buffer // toDo: Amorphs !!!
    }
    return false;
};
Colony.prototype.getOptLabor = function()
{
    var p = this.planet;
    var defense = 15; // avoid detection
    if (p.targetdefense > 15) defense = p.targetdefense;
    var pStructures = [
        { structures: "targetmines", n: p.targetmines, thresh: 200 },
        { structures: "targetfactories", n: p.targetfactories, thresh: 100 },
        { structures: "targetdefense", n: defense, thresh: 50 }
    ];
    pStructures.forEach(function (item, index) {
        pStructures[index].optLabor = p[item.structures];
        if (p[item.structures] > item.thresh)
        {
            pStructures[index].optLabor = item.thresh + Math.pow((p[item.structures] - item.thresh), 2);
        }
    });
    pStructures.sort(
        function(a, b)
        {
            var x = a.optLabor;
            var y = b.optLabor;
            if (x < y) {return 1;}
            if (x > y) {return -1;}
            return 0;
        }
    );
    return pStructures[0].optLabor;
};
Colony.prototype.getOptBovSupClans = function()
{
    if (this.planet.nativeracename === "Bovinoid") {
        return Math.round(this.planet.nativeclans / 100);
    }
    return 0;
};
Colony.prototype.getColonistHappinessChange = function(taxrate) // returns -/0/+ amount of happynesspoints = change in happiness using taxrate
{
    var p = this.planet;
    var raceMod = 1; // toDo: Federation = 2
    var baseTemp = 50;
    var addHappyness = 0;
    if (vgap.player.raceid === 7) baseTemp = 100; // Crystals
    if (vgap.player.raceid === 2) // Lizards
    {
        var ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0)
        {
            ships.forEach(function (s) {
                if (s.mission === 8) addHappyness += 5; // Hisssss
            });
        }
    }
    // Colonists: TRUNC((1000 - SQRT(Colonist Clans) - 80 * (Colonist Tax Rate) - ABS(BaseTemp - Temperature) * 3 - (Factories + Mines) / 3 ) /100)
    return addHappyness + ( Math.round( (1000 - Math.sqrt(p.clans) - 80 * taxrate - Math.abs(baseTemp - p.temp) * 3 - (p.mines + p.factories) / 3 ) / 100) );

};
Colony.prototype.getMaxHappyColonistTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (var i = 50; i > 0; i--)
    {
        var happinessChange = this.getColonistHappinessChange(i);
        if (happinessChange > -1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMinHappyColonistTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (var i = 1; i < 50; i++)
    {
        var happinessChange = this.getColonistHappinessChange(i);
        if (happinessChange < 1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getIncomeFromColonists = function(taxRate)
{
    if (typeof taxRate === "undefined") taxRate = this.planet.colonisttaxrate;
    //console.log("Income from colonists with taxrate " + taxRate + " = " + (this.planet.clans * taxRate * 0.001));
    return (this.planet.clans * taxRate * 0.001);
};
Colony.prototype.setTargetClans = function()
{
    var p = this.planet;
    if (this.maxColPop < 100)
    {
        this.target.clans = this.maxColPop;
    } else
    {
        var targets = [ 100, this.optLabor ];
        //if (this.isSetToGrow) targets.push(this.minColPop);
        if (p.nativeracename === "Bovinoid") targets.push(this.optBovSupClans);
        //if (autopilot.hizzzerPlanets.indexOf(p.id) > -1) targets.push(this.maxColPop); // maximize colonist population on hizzzer planets, although optNatTaxClans should be enough!
        if (this.isFort && this.hasStarbase && p.clans < this.maxColPop) targets.push(this.maxColPop); // fortification: maximize colonist population (if a starbase is present)
        if (this.isSqueezingPopulations() && p.nativeclans > 0) targets.push(this.squeezeColPop); // squeezing taxation: colonists necessary to collect maximum revenue
        if (this.isTaxingByDefault() && p.nativeclans > 0) targets.push(this.optNatTaxClans); // squeezing taxation: colonists necessary to collect maximum revenue
        targets.sort(function(a, b){return b - a;}); // sort to get the most severe target
        this.target.clans = targets[0];
    }
};
Colony.prototype.getClanDeficiency = function()
{
    this.setTargetClans();
    var p = this.planet;
    var deficiency = p.clans + this.curColPopGrowth - this.target.clans;
    if (deficiency > 0) deficiency -= this.curColPopGrowth;
    if (deficiency < 0)
    {
        this.isSink = true;
        this.isColonistSink = true;
    }
    return deficiency;
};
/*
    MISSIONS
*/
Colony.prototype.isDoomed = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.taxation === "des");
    } else
    {
        return false;
    }
};
Colony.prototype.isBuildingStarbase = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        if (this.hasStarbase && cfg.pMission === "bba")
        {
            cfg.pMission = false;
            autopilot.syncLocalPlaneteerStorage(cfg);
        }
        return (cfg.pMission === "bba");
    } else
    {
        return false;
    }
};
Colony.prototype.isSellingSupply = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.production === "ssu");
    } else
    {
        return false;
    }
};
Colony.prototype.isBuildingStructures = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.production === "bst");
    } else
    {
        return false;
    }
};
Colony.prototype.setBaseDeficiency = function()
{
    this.balance.megacredits -= 900;
    this.balance.duranium -= 120;
    this.balance.tritanium -= 402;
    this.balance.molybdenum -= 340;
};
Colony.prototype.isSqueezingPopulations = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.taxation === "stx");
    } else
    {
        return false;
    }
};
Colony.prototype.isTaxing4Growth = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.taxation === "grw");
    } else
    {
        return false;
    }
};
Colony.prototype.isTaxingByDefault = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.taxation === "dft");
    } else
    {
        return false;
    }
};
Colony.prototype.isFortifying = function()
{
    var cfg = autopilot.planetIsInStorage(this.planet.id);
    if (cfg)
    {
        return (cfg.pMission === "bfo");
    } else
    {
        return false;
    }
};
Colony.prototype.squeezeColonists = function()
{
    var p = this.planet;
    var curHappyChange = 0;
    var curIncome = 0;
    var happyExcess = 0;
    var startTaxation = 0;
    if (p.clans > 1000) // = 100000 colonists
    {
        //if (p.colonisttaxrate > 100) p.colonisttaxrate = 99;
        curHappyChange = this.getColonistHappinessChange(p.colonisttaxrate);
        var futureHappyness = p.colonisthappypoints + curHappyChange;
        if (futureHappyness > 40) // keep happiness above 39 (< 39 = rioting)
        {
            curIncome = this.getIncomeFromColonists(p.colonisttaxrate);
            happyExcess = p.colonisthappypoints - 40;
            //console.log("happyExcess: " + happyExcess);
            //console.log("happyChange: " + curHappyChange);
            if (happyExcess > 0 && (curHappyChange *-1) < happyExcess && p.colonisttaxrate < 100)
            {
                // there is room to squeeze... set taxrate so happyExcess is reduced to 0
                startTaxation = p.colonisttaxrate;
                while ((curHappyChange + happyExcess) > 0 && curIncome < 5000)
                {
                    startTaxation++;
                    if (startTaxation > 99) break;
                    curHappyChange = this.getColonistHappinessChange(startTaxation);
                    curIncome = this.getIncomeFromColonists(startTaxation);
                }
                // use current startTaxation -1 point
                if (curIncome > 500)
                {
                    if (vgap.player.raceid === 6 && (startTaxation - 1) > 20) // borg tax limitation
                    {
                        p.colonisttaxrate = 20;
                    } else
                    {
                        p.colonisttaxrate = (startTaxation - 1);
                    }
                }
            } else
            {
                p.colonisttaxrate = 0;
            }
        } else
        {
            p.colonisttaxrate = 0;
        }
    }
};
Colony.prototype.squeezeNatives = function()
{
    var p = this.planet;
    var curHappyChange = 0;
    var curIncome = 0;
    var happyExcess = 0;
    var startTaxation = 0;
    if (p.nativeclans > 0 && p.nativegovernment >= 2 && p.nativeracename !== "Amorphous")
    {
        curHappyChange = this.getNativeHappinessChange(p.nativetaxrate);
        var futureHappyness = p.nativehappypoints + curHappyChange;
        if (futureHappyness > 40) // keep happiness above 40 (< 39 = rioting)
        {
            curHappyChange = this.getNativeHappinessChange(p.nativetaxrate);
            curIncome = this.getIncomeFromNatives(p.nativetaxrate);
            happyExcess = p.nativehappypoints - 40;
            if (happyExcess > 0 && (curHappyChange *-1) < happyExcess && p.nativetaxrate < 100)
            {
                // there is room to squeeze... set taxrate so happyExcess is reduced to 0
                startTaxation = p.nativetaxrate;
                while ((curHappyChange + happyExcess) > 0 && curIncome < 5000 && curIncome < p.clans)
                {
                    startTaxation++;
                    if (startTaxation > 99) break;
                    curHappyChange = this.getNativeHappinessChange(startTaxation);
                    curIncome = this.getIncomeFromNatives(startTaxation);
                }
                // use current startTaxation -1 point
                var optTaxClans = this.getOptNatTaxClans((startTaxation - 1)); // how much clans we need to get all taxes
                //console.log(optTaxClans);
                if (p.clans > (optTaxClans * 0.95) || curIncome > 500) // only act when more than 95 % of the required colonists are present
                {
                    if (vgap.player.raceid === 6 && (startTaxation - 1) > 20) // borg tax limitation
                    {
                        p.nativetaxrate = 20;
                    } else
                    {
                        p.nativetaxrate = (startTaxation - 1);
                    }
                }
            }
        } else
        {
            p.nativetaxrate = 0;
        }
    }
};
Colony.prototype.squeezeTaxes = function()
{
    this.drawTaxMissionIndicator();
    this.squeezeNatives();
    this.squeezeColonists();
};
Colony.prototype.setDefaultTaxrate = function()
{
    var p = this.planet;
    this.setDefaultColonistTaxrate(); // natives
    if (p.nativeclans > 0 && p.nativeracename !== "Amorphous") this.setDefaultNativeTaxrate(); // natives
};
Colony.prototype.setDefaultNativeTaxrate = function()
{
    // default:
    // - adjust taxrate so there is no change in happiness
    // - limited by colonist population and income (> 99 mcs)
    // - no taxation if there are less than 40 happypoints
    //
    var p = this.planet;
    //
    if (parseInt(p.nativehappypoints) > 40)
    {
        var happyEquiTaxRate = Math.floor(this.getMaxHappyNativeTaxRate());
        var nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        //
        while (nativeTaxMcs > p.clans) // get taxrate that fits the availability of colonists
        {
            happyEquiTaxRate--;
            nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        var curIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            p.nativetaxrate = happyEquiTaxRate;
        } else
        {
            p.nativetaxrate = 0;
        }
    } else
    {
        p.nativetaxrate = 0;
    }
};
Colony.prototype.setDefaultColonistTaxrate = function()
{
    // default:
    // - adjust taxrate so there is no change in happiness
    // - limited by income (> 99 mcs)
    // - no taxation if there are less than 40 happypoints
    //
    var p = this.planet;
    //
    if (parseInt(p.colonisthappypoints) > 40)
    {
        var happyEquiTaxRate = Math.floor(this.getMaxHappyColonistTaxRate());
        var curIncome = this.getIncomeFromColonists(happyEquiTaxRate);
        //
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            p.colonisttaxrate = happyEquiTaxRate;
        } else
        {
            p.colonisttaxrate = 0;
        }
    } else
    {
        p.colonisttaxrate = 0;
    }
};
Colony.prototype.setGrowthTaxrate = function()
{
    var p = this.planet;
    this.setGrowthColonistTaxrate();
    if (p.nativeclans > 0 && p.nativeracename !== "Amorphous") this.setGrowthNativeTaxrate();
};
Colony.prototype.setGrowthNativeTaxrate = function()
{
    // growth:
    // - adjust taxrate so there is no change in happiness
    // - limited by colonist population and income (> 99 mcs)
    // - no taxation if there are less than 70 happypoints (= no growth)
    //
    var p = this.planet;

    //
    if (parseInt(p.nativehappypoints) >= 70)
    {
        var happyEquiTaxRate = Math.floor(this.getMinHappyNativeTaxRate());
        var nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        //
        while (nativeTaxMcs > p.clans) // get taxrate that fits the availability of colonists
        {
            happyEquiTaxRate--;
            nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        var curIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            p.nativetaxrate = happyEquiTaxRate;
        } else
        {
            p.nativetaxrate = 0;
        }
    } else
    {
        p.nativetaxrate = 0;
    }
};
Colony.prototype.setGrowthColonistTaxrate = function()
{
    // growth:
    // - adjust taxrate so there is no change in happiness
    // - limited by income (> 99 mcs)
    // - no taxation if there are less than 70 happypoints (= no growth)
    //
    var p = this.planet;
    //
    if (parseInt(p.colonisthappypoints) >= 70)
    {
        var happyEquiTaxRate = Math.floor(this.getMinHappyColonistTaxRate());
        var curIncome = this.getIncomeFromColonists(happyEquiTaxRate);
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            p.colonisttaxrate = happyEquiTaxRate;
        } else
        {
            p.colonisttaxrate = 0;
        }
    } else
    {
        p.colonisttaxrate = 0;
    }
};
Colony.prototype.setFortDeficiency = function()
{
    var p = this.planet;
};
/*
    APS HELPERS
 */
Colony.prototype.getDistance = function (ship)
{
    return Math.ceil(autopilot.getDistance( { x: this.planet.x, y: this.planet.y }, { x: ship.x ,y: ship.y } ));
};
Colony.prototype.getSumForCargo = function (shipFunction, ooi)
{
    if (shipFunction === "col")
    {
        return this.getCollectorCargo(ooi);
    } else if (shipFunction === "dis")
    {
        return this.getDistributorCargo(ooi);
    } else if (shipFunction === "exp")
    {
        //return this.getExpanderCargo(ooi);
    }
};
Colony.prototype.getCollectorCargo = function (ooi)
{
    var mA = this.abrMoveables;
    if (ooi === "all")
    {
        if (this.collectorMinerals > 0) return this.collectorMinerals;
    } else
    {
        if (this.balance[mA[ooi]] > 0) return this.balance[mA[ooi]];
    }
    return 0;
};
Colony.prototype.getDistributorCargo = function (ooi)
{
    var mA = this.abrMoveables;
    if (typeof ooi === "undefined" || ooi === "all")
    {
        if (this.balance.clans > 0 && this.balance.supplies > 0) return (this.balance.clans + this.balance.supplies);
        if (this.balance.clans > 0) return this.balance.clans;
        if (this.balance.supplies > 0) return this.balance.supplies;
    } else
    {
        var dC = 0;
        if (ooi === "sup")
        {
            dC = this.planet.supplies - autopilot.settings.defSupRetention;
        } else if (ooi === "cla")
        {
            dC = this.balance[mA[ooi]];
        } else if (ooi === "mcs")
        {
            dC = this.planet.megacredits - autopilot.settings.defMcsRetention;
        } else if (ooi === "neu")
        {
            dC = this.planet.neutronium - autopilot.settings.defNeuRetention;
        }
        if (dC > 0) return dC;
    }
    return 0;
};
Colony.prototype.getBuilderCargo = function (ooi)
{
    var b = this.balance;
    if (typeof ooi === "undefined") return false;
    {
        var dC = 0;
        if (ooi === "bub")
        {
            dC = b.duranium + b.tritanium + b.molybdenum;
        } else if (ooi === "stb")
        {
            dC = b.clans + b.supplies;
        }
        if (dC > 0) return dC;
    }
    return 0;
};
Colony.prototype.getBuilderDemand = function (ooi)
{
    var b = this.balance;
    if (typeof ooi === "undefined") return false;
    {
        var dC = 0;
        if (ooi === "bub")
        {
            if (b.duranium < 0) dC += b.duranium;
            if (b.tritanium < 0) dC += b.tritanium;
            if (b.molybdenum < 0) dC += b.molybdenum;
        } else if (ooi === "stb")
        {
            var s = this.structures;
            if (s.factories.def > 0 || s.mines.def > 0 || s.defense.def > 0)
            {
                if (b.supplies < 0) dC += b.supplies;
                if (b.clans < 0) dC += b.clans;
            }
        }
        if (dC < 0) return dC;
    }
    return 0;
};
/*
    INDICATORES
 */
Colony.prototype.drawStarbaseIndicators = function()
{
    var p = this.planet;
    if (vgap.map.canvas && autopilot.settings.planetGFX)
    {
        var markup = {
            attr : {
                stroke : autopilot.idColors[autopilot.objectTypeEnum.BASES],
                lineWidth: 3,
                lineCap: "round",
                lineDash: false
            }
        };
        if (this.hasStarbase && !this.hasStarbase.isbuilding && !this.isFort) // starbase (not a fort) is not building any ships
        {
            autopilot.drawScaledQuarterCircle(p.x, p.y, 13, "nw", markup.attr, null, 0.5);
        } else if (!this.hasStarbase && this.isBuildingBase) // current planet is ordered to build a starbase
        {
            autopilot.drawScaledQuarterCircle(p.x, p.y, 12, "nw", markup.attr, null, 0.5);
            autopilot.drawScaledQuarterCircle(p.x, p.y, 10, "nw", markup.attr, null, 0.5);
            autopilot.drawScaledQuarterCircle(p.x, p.y, 8, "nw", markup.attr, null, 0.5);
            autopilot.drawScaledQuarterCircle(p.x, p.y, 6, "nw", markup.attr, null, 0.5);
        }
    }
};
Colony.prototype.drawFortIndicators = function()
{
    var p = this.planet;
    if (vgap.map.canvas && autopilot.settings.planetGFX)
    {
        var markup = {
            attr: {
                stroke: "#C0C0C0",
                lineWidth: 1,
                lineCap: "round",
                lineDash: false
            }
        };
        // general fortifying circle (planet or planet with starbase)
        autopilot.drawScaledCircle(p.x, p.y, 14, markup.attr, null, 0.5);
        // with starbase
        var withSb = this.hasStarbase;
        if (withSb) {
            var sbFighters = withSb.fighters / 60;
            var sbDefense = withSb.defense / 200;
            var sbBeamTech = withSb.beamtechlevel / 10;
            // show deficiency to reach max defense
            if (sbDefense < 1 || sbFighters < 1 || sbBeamTech < 1)
            {
                markup.attr.lineWidth = 3;
                markup.attr.stroke = autopilot.idColors[autopilot.objectTypeEnum.FORT];
                if (sbDefense < 1) autopilot.drawScaledQuarterCircle(p.x, p.y, 12, "nw", markup.attr, null, 0.5, 1 - sbDefense);
                if (sbFighters < 1) autopilot.drawScaledQuarterCircle(p.x, p.y, 11, "nw", markup.attr, null, 0.5, 1 - sbFighters);
                if (sbBeamTech < 1) autopilot.drawScaledQuarterCircle(p.x, p.y, 10, "nw", markup.attr, null, 0.5, 1 - sbBeamTech);
                // additional starbase fortifying circle
                markup.attr.lineWidth = 1;
                markup.attr.stroke = "#C0C0C0";
                autopilot.drawScaledCircle(p.x, p.y, 12, markup.attr, null, 0.5);
            } else
            {
                // if max defense has been reached, draw additional starbase fortifiying circle stronger
                markup.attr.lineWidth = 3;
                markup.attr.stroke = "#e83080";
                autopilot.drawScaledCircle(p.x, p.y, 12, markup.attr, null, 0.5);
            }
        }
    }
};
Colony.prototype.drawMineralValueIndicator = function()
{
    var p = this.planet;
    if (vgap.map.canvas && vgap.map.zoom <= 7.6 && autopilot.settings.planetGFX)
    {
        var markup = {
            attr: {
                stroke: "#C0C0C0",
                lineWidth: 1,
                lineCap: "round",
                lineDash: false
            }
        };
        // we draw a quarter circle when zoom is low, that shows the planets mineral value
        // (all values refer to surface + ground minerals)
        //
        // white: no mineral with more than 1000 kt
        // orange: at least one mineral with more than 1000 kt (color according to that mineral - see detailed mineral indicators)
        // red: at least one mineral with more than 5000 kt (color according to that mineral - see detailed mineral indicators)
        //
        // if more than one mineral exceeds the corresponding value, the one with the highest value will be indicated in color
        //
        var fillCols = {
            neu: "#B22222",
            dur: "#00bfff",
            tri: "#ff8000",
            mol: "#0040ff"
        };
        var allNeu = p.neutronium + p.groundneutronium;
        var allDur = p.duranium + p.groundduranium;
        var allTri = p.tritanium + p.groundtritanium;
        var allMol = p.molybdenum + p.groundmolybdenum;
        var sorted = [
            {
                mineral: "neu",
                value: allNeu
            },
            {
                mineral: "dur",
                value: allDur
            },
            {
                mineral: "tri",
                value: allTri
            },
            {
                mineral: "mol",
                value: allMol
            }].sort(function(a, b){return b.value - a.value});
        var curFillCol = fillCols[sorted[0].mineral];
        if (allNeu > 5000 || allDur > 5000 || allTri > 5000 || allMol > 5000)
        {
            autopilot.drawFilledQuarterCircle(p.x, p.y, 12, "ne", markup.attr, null, 0.5, 0.3, curFillCol);
        } else if (allNeu > 1000 || allDur > 1000 || allTri > 1000 || allMol > 1000)
        {
            autopilot.drawFilledQuarterCircle(p.x, p.y, 12, "ne", markup.attr, null, 0.5, 0.6, curFillCol);
        } else
        {
            autopilot.drawFilledQuarterCircle(p.x, p.y, 12, "ne", markup.attr, null, 0.5, 0.8, false);
        }
    }
};
Colony.prototype.drawNativeIndicators = function()
{
    var p = this.planet;
    if (p.nativeclans > 0 && p.nativeracename !== "Amorphous" && vgap.map.zoom <= 7.6 && vgap.map.canvas && autopilot.settings.planetGFX)
    {
        var markup = {
            attr: {
                stroke: "#FFFFFF",
                lineWidth: 5,
                lineDash: false,
                outline: false,
                outlineStroke: "#FFA500"
            }
        };
        // government = alpha
        var alpha = ((p.nativegovernment / 5) * 0.3);
        // population size = line width
        markup.attr.lineWidth = 5 + Math.ceil(p.nativeclans / 10000);
        // native race = strong circle border, if tec 10 inducer
        if (this.hasTecRace) markup.attr.outline = true;
        autopilot.drawFilledCircle(p.x, p.y, 1.5, markup.attr, null, alpha);
    }
};
Colony.prototype.drawTaxMissionIndicator = function()
{
    var p = this.planet;
    if (vgap.map.zoom > 3)
    {
        var markup = {
            attr : {
                stroke : "#e6e600",
                lineWidth: 3,
                lineCap: "round",
                lineDash: false
            }
        };
        autopilot.drawScaledQuarterCircle(p.x, p.y, 8, "sw", markup.attr, null, 0.5);
        //autopilot.drawScaledQuarterCircle(p.x, p.y, 7, "sw", markup.attr, null, 0.5);
        autopilot.drawScaledQuarterCircle(p.x, p.y, 6, "sw", markup.attr, null, 0.5);
    }
};	/*
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
     *  Container for local storage data entries
     *  AutoPilotShip configuration
     */
    function APSdata(data)
    {
        if (data)
        {
            this.sid = data.sid;
            this.base = data.base;
            this.shipFunction = data.shipFunction;
            //
            this.oShipMission = data.oShipMission;
            this.ooiPriority = data.ooiPriority;
            this.currentOoi = data.currentOoi;
            this.destination = data.destination;
            this.secondaryDestination = data.secondaryDestination;
            this.lastDestination = data.lastDestination;
            this.newFunction = data.newFunction;
            this.newOoiPriority = data.newOoiPriority;
            this.idle = data.idle;
            this.idleReason = data.idleReason;
            this.idleTurns = data.idleTurns;
        }
        // set defaults (not already set in data)
        if (typeof this.oShipMission === "undefined") this.oShipMission = 0; // exploration
        if (typeof this.ooiPriority === "undefined") this.ooiPriority = false;
        if (typeof this.currentOoi === "undefined") this.currentOoi = false;
        if (typeof this.destination === "undefined") this.destination = false;
        if (typeof this.secondaryDestination === "undefined") this.secondaryDestination = false;
        if (typeof this.lastDestination === "undefined") this.lastDestination = false;
        if (typeof this.newFunction === "undefined") this.newFunction = false;
        if (typeof this.newOoiPriority === "undefined") this.newOoiPriority = false;
        if (typeof this.idle === "undefined") this.idle = false;
        if (typeof this.idleReason === "undefined") this.idleReason = false;
        if (typeof this.idleTurns === "undefined") this.idleTurns = 0;
    }
    APSdata.prototype.getData = function()
    {
        // mandatory fields
        if (typeof this.sid === "undefined" || typeof this.base === "undefined" || typeof this.shipFunction === "undefined") return false;
        return {
            sid: this.sid,
            base: this.base,
            shipFunction: this.shipFunction,
            oShipMission: this.oShipMission,
            ooiPriority: this.ooiPriority,
            currentOoi: this.currentOoi,
            destination: this.destination,
            secondaryDestination: this.secondaryDestination,
            lastDestination: this.lastDestination,
            newFunction: this.newFunction,
            newOoiPriority: this.newOoiPriority,
            idle: this.idle,
            idleReason: this.idleReason,
            idleTurns: this.idleTurns
        };
    };
    /*
     *  Container for local storage data entries
     *  AutoPilotPlanet configuration
     */
    function APPdata(data)
    {
        if (data)
        {
            this.pid = data.pid;
            this.pMission = data.pMission;
            this.production = data.production;
            this.taxation = data.taxation;
            // set defaults (not already set in data)
            if (typeof this.pMission === "undefined") this.pMission = "off";
            if (typeof this.production === "undefined") this.production = "bst";
            if (typeof this.taxation === "undefined" || !this.taxation) this.taxation = "dft";
        }
    }
    APPdata.prototype.getData = function()
    {
        // mandatory field
        if (typeof this.pid === "undefined") return false;
        return {
            pid: this.pid,
            pMission: this.pMission,
            production: this.production,
            taxation: this.taxation
        };
    };
    /*
     *  Container for local storage data entries
     *  Plugin Settings
     */
    function APSSettings(setup)
    {
        if (setup)
        {
            this.debug = setup.debug;
            this.planetGFX = setup.planetGFX;
            this.planetMNG = setup.planetMNG;
            this.shipGFX = setup.shipGFX;
            this.colScopeRange = setup.colScopeRange;
            this.colMinCapacity = setup.colMinCapacity;
            this.disScopeRange = setup.disScopeRange;
            this.disMinCapacity = setup.disMinCapacity;
            this.minSbFighter = setup.minSbFighter; // toDo: integrate into nu-Dashboard
            this.minSbDefense = setup.minSbDefense; // toDo: integrate into nu-Dashboard
            this.defMcsRetention = setup.defMcsRetention; // default megacredit retention
            this.sbMcsRetention = setup.sbMcsRetention; // default megacredit retention @ starbase
            this.defSupRetention = setup.defSupRetention; // default supplies retention
            this.sbSupRetention = setup.sbSupRetention; // default supplies retention @ starbase
            this.defNeuRetention = setup.defNeuRetention; // default fuel retention
            this.sbNeuRetention = setup.sbNeuRetention; // default fuel retention @ starbase
            this.frtNeuRetention = setup.frtNeuRetention; // default fuel retention @ fort
            this.defPlanetDef = setup.defPlanetDef; // default planetary defense
            this.defPlanetSbDef = setup.defPlanetSbDef; // default additional planetary defense if Starbase is present
            this.defPlanetFortDef = setup.defPlanetFortDef; // default additional planetary defense if Fortification is set
        }
        //
        // set default values
        //
        if (typeof this.debug === "undefined") this.debug = false;
        if (typeof this.planetGFX === "undefined") this.planetGFX = true;
        if (typeof this.planetMNG === "undefined") this.planetMNG = true;
        if (typeof this.shipGFX === "undefined") this.shipGFX = true;
        if (typeof this.colScopeRange === "undefined") this.colScopeRange = "auto";
        if (typeof this.colMinCapacity === "undefined") this.colMinCapacity = 0.5;
        if (typeof this.disScopeRange === "undefined") this.disScopeRange = "auto";
        if (typeof this.disMinCapacity === "undefined") this.disMinCapacity = 0.5;
        if (typeof this.minSbFighter === "undefined") this.minSbFighter = 20;
        if (typeof this.minSbDefense === "undefined") this.minSbDefense = 50;
        if (typeof this.defMcsRetention === "undefined") this.defMcsRetention = 50;
        if (typeof this.sbMcsRetention === "undefined") this.sbMcsRetention = 500;
        if (typeof this.defSupRetention === "undefined") this.defSupRetention = 50;
        if (typeof this.sbSupRetention === "undefined") this.sbSupRetention = 1000;
        if (typeof this.defNeuRetention === "undefined") this.defNeuRetention = 100;
        if (typeof this.sbNeuRetention === "undefined") this.sbNeuRetention = 500;
        if (typeof this.frtNeuRetention === "undefined") this.frtNeuRetention = 100;
        if (typeof this.defPlanetDef === "undefined") this.defPlanetDef = 15;
        if (typeof this.defPlanetSbDef === "undefined") this.defPlanetSbDef = 85;
        if (typeof this.defPlanetFortDef === "undefined") this.defPlanetFortDef = 35;
    }
    APSSettings.prototype.getSettings = function()
    {
        return {
            debug: this.debug,
            planetGFX: this.planetGFX,
            planetMNG: this.planetMNG,
            shipGFX: this.shipGFX,
            colScopeRange: this.colScopeRange,
            colMinCapacity: this.colMinCapacity,
            disScopeRange: this.disScopeRange,
            disMinCapacity: this.disMinCapacity,
            minSbFighter: this.minSbFighter,
            minSbDefense: this.minSbDefense,
            defMcsRetention: this.defMcsRetention,
            sbMcsRetention: this.sbMcsRetention,
            defSupRetention: this.defSupRetention,
            sbSupRetention: this.sbSupRetention,
            defNeuRetention: this.defNeuRetention,
            sbNeuRetention: this.sbNeuRetention,
            frtNeuRetention: this.frtNeuRetention,
            defPlanetDef: this.defPlanetDef,
            defPlanetSbDef: this.defPlanetSbDef,
            defPlanetFortDef: this.defPlanetFortDef
        };
    };    /*
     *  PLANETSCREEN OVERWRITE
     */
    vgapPlanetScreen.prototype.load = function(b)
    {
        this.planet = b;
        this.starbase = vgap.getStarbase(b.id);
        this.planet.changed = 1;
        this.hasStarbase = this.starbase != null ? 1 : 0;
        this.ships = vgap.shipsAt(b.x, b.y);
        this.fcodes = vgap.getPlanetCodes(this.starbase != null );
        this.selectedpodhullid = b.podhullid;
        this.screen = new leftContent("PlanetScreen",b.id + ": " + b.name,b,function() {
                vgap.map.deselectPlanet()
            }
        );
        this.screen.addFleetView();
        if (vgap.player.raceid != 12) {
            var a = new Array();
            if (!vgap.settings.isacademy) {
                a.push({
                    name: nu.t.changefriendly,
                    onclick: function() {
                        vgap.planetScreen.changeFriendly()
                    }
                })
            }
            a.push({
                name: nu.t.build,
                onclick: function() {
                    vgap.planetScreen.build()
                }
            });
            this.screen.addSection("Buildings", nu.t.buildings, a, function() {
                return vgap.planetScreen.loadBuildings()
            })
        }
        var a = new Array();
        if (this.ships.length > 0 && !vgap.settings.isacademy) {
            a.push({
                name: nu.t.transfer,
                onclick: function() {
                    vgap.planetScreen.transfer()
                }
            })
        }
        if (vgap.settings.isacademy) {
            if (vgap.getStarbase(b.id) == null ) {
                a.push({
                    name: nu.t.buildstarbase,
                    onclick: function() {
                        vgap.planetScreen.buildStarbase()
                    },
                    id: "BuildBaseBar"
                })
            }
            if (vgap.getStarbase(b.id) != null ) {
                a.push({
                    name: nu.t.starbase,
                    onclick: function() {
                        vgap.map.selectStarbase(b.id)
                    }
                })
            }
        } else {
            a.push({
                name: nu.t.notes,
                onclick: function() {
                    shtml.editNote(b.id, 1)
                },
                id: "NoteButton"
            })
        }
        this.screen.addSection(vgap.settings.isacademy ? "Colony" : "Resources", nu.t.resources, a, function() {
            return vgap.planetScreen.loadResources()
        });
        if (!vgap.settings.isacademy) {
            if (b.clans > 0 || b.nativeclans > 0) {
                var a = new Array();
                if (vgap.player.raceid != 12) {
                    a.push({
                        name: nu.t.taxrates,
                        onclick: function() {
                            vgap.planetScreen.taxRates()
                        }
                    });
                    if (vgap.getStarbase(b.id) == null )
                    {
                        a.push({
                            name: nu.t.buildstarbase,
                            onclick: function() {
                                vgap.planetScreen.buildStarbase()
                            },
                            id: "BuildBaseBar"
                        })
                    }
                    if (vgap.getStarbase(b.id) != null ) {
                        a.push({
                            name: nu.t.starbase,
                            onclick: function() {
                                vgap.map.selectStarbase(b.id)
                            }
                        })
                    }
                    // #############nuPilot - start##################
                    a.push({
                        name: "APC",
                        onclick: function() {
                            vgap.planetScreen.autoplanetControl(this.planet);
                        },
                        id: "APlCtrl"
                    })
                    // #############nuPilot - end##################
                } else {
                    a.push({
                        name: "Allocate Workers",
                        onclick: function() {
                            vgap.planetScreen.allocateWorkers()
                        }
                    })
                }
                this.colony = this.screen.addSection("Colony", nu.t.colony, a, function() {
                    return vgap.planetScreen.loadColony()
                });
                if (b.buildingstarbase) {
                    $("#BuildBaseBar").html("<span>" + nu.t.buildingstarbase + "</span>")
                }
            }
        } else {
            b.colonisttaxrate = 5;
            b.nativetaxrate = 10;
            if (b.nativetype == 4) {
                b.nativetaxrate = 15
            }
            if (b.nativetype == 5) {
                b.nativetaxrate = 0
            }
        }
        if (vgap.player.raceid == 12) {
            var a = new Array();
            a.push({
                name: nu.t.build,
                onclick: function() {
                    vgap.planetScreen.buildPod()
                }
            });
            a.push({
                name: nu.t.speed,
                onclick: function() {
                    vgap.planetScreen.warpSpeed()
                }
            });
            this.screen.addSection("PodLaunch", nu.t.orders, a, function() {
                return vgap.planetScreen.loadOrders()
            })
        }
        vgap.callPlugins("loadplanet");
        this.screen.bindTopics();
        vgap.hotkeysOn = true;
        vgap.action()
    };
    vgapPlanetScreen.prototype.autoplanetControl = function(p)
    {
        var appFunctions = [
            {
                id: 2,
                name: "Defense Manager",
                nameActive: "<strong>> Defense Manager</strong>",
                desc: "Defensive missions (APS supported)...",
                options: {
                    bba: "build SB ",
                    bfo: "fortify ",
                    off: "off"
                },
                planetFlag: "stx",
                field: "pMission"
            },
            {
                id: 3,
                name: "Taxation Manager",
                nameActive: "<strong>> Taxation Manager</strong>",
                desc: "Taxation strategies...",
                options: {
                    des: "destroy ", // squeeze
                    stx: "exploit ", // squeeze
                    grw: "growth ",
                    dft: "default ",
                    off: "off"
                },
                planetFlag: "stx",
                field: "taxation"
            },
            {
                id: 4,
                name: "Production Manager",
                nameActive: "<strong>> Production Manager</strong>",
                desc: "Production options...",
                options: {
                    ssu: "sell supply ",
                    bst: "build structures ",
                    off: "off"
                },
                planetFlag: "ssu",
                field: "production"
            }
        ];
        vgap.more.empty();
        var isAPP = autopilot.planetIsInStorage(vgap.planetScreen.planet.id);

        $("<div id='OrdersScreen'><h1>Planetary Missions</h1></div>").appendTo(vgap.more);
        //
        for (var a = 0; a < appFunctions.length; a++)
        {
            var c = appFunctions[a];

            var cDisplayName = c.name;

            if (isAPP && c.field && isAPP[c.field] !== "off") cDisplayName = c.nameActive;

            var setPlanetMission = function (option, field) {
                return function () {
                    if (typeof option !== "undefined")
                    {
                        console.log("Setting " + field + " to " + option);
                        var updatedData;
                        if (isAPP)
                        {
                            updatedData = isAPP;
                            updatedData[field] = option;
                        } else // issue new orders
                        {
                            var planet = {
                                pid: vgap.planetScreen.planet.id
                            };
                            planet[field] = option;
                            updatedData = new APPdata(planet);
                        }
                        autopilot.syncLocalPlaneteerStorage(updatedData); // save new orders
                        var c = new Colony(vgap.planetScreen.planet.id, false); // apply (new) orders
                    }
                    vgap.closeMore();
                };
            };
            if (c.options) {
                $("<div>" + cDisplayName + "<span>" + c.desc + "<br/>Options: <b id='mOptions" + c.id + "'></b></span></div>").tclick(setPlanetMission()).appendTo("#OrdersScreen");
                Object.keys(c.options).forEach(
                    function(key) {
                        var setPlanetMission = function (option, field) {
                            return function ()
                            {
                                if (typeof option === "undefined") return;
                                console.log("Setting " + field + " to " + option);
                                var updatedData;
                                if (isAPP)
                                {
                                    updatedData = isAPP;
                                    updatedData[field] = option;
                                } else // issue new orders
                                {
                                    var planet = {
                                        pid: vgap.planetScreen.planet.id
                                    };
                                    planet[field] = option;
                                    updatedData = new APPdata(planet);
                                }
                                autopilot.syncLocalPlaneteerStorage(updatedData); // save new orders
                                var c = new Colony(vgap.planetScreen.planet.id, false); // apply (new) orders
                                console.log("Planet changed?");
                                console.log(c.planet.changed);
                                return false;
                            };
                        };
                        var cOptionStyle = "color:cyan;font-size:10px;text-decoration:underline;";
                        if (isAPP && c.field && isAPP[c.field] === key) cOptionStyle = "color:cyan;font-size: 10px;text-decoration:overline;";
                        $("<a style='" + cOptionStyle + "'>" + c.options[key] + " </a>]").tclick(setPlanetMission(key, c.field)).appendTo("#mOptions" + c.id);
                        //console.log(key + ': ' + nameObj[key]);
                    }
                );
            } else {
                $("<div>" + cDisplayName + "<span>" + c.desc + "</span></div>").tclick(setPlanetMission(c.planetFlag, c.field)).appendTo("#OrdersScreen");
            }
        }
        shtml.moreBack();
        vgap.showMore();
    };
	/*
	 *  SHIPSCREEN OVERWRITE
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
            } );
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
            //
            //
            //
            if (c.hullid < 200 || c.hullid > 300) {
                var a = new Array();
                if (vgap.player.raceid != 12)
                {
                    // #############nuPilot - start##################
                    a.push({
                        name: "nPC",
                        onclick: function() {
                            vgap.shipScreen.autopilotControl(this.planet);
                        }
                    });
                    // #############nuPilot - end##################
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
                nameActive: "<strong>> Collecting Resources</strong>",
			 	desc: "Collect resources and deliver them to the current planet.",
				shipFunction: "col",
				ooiOptions: [ "all", "neu", "dur", "tri", "mol", "cla", "mcs", "sup" ],
                action: false,
				hullId: 0
			},
			{
				name: "Distributor",
                nameActive: "<strong>> Distributing</strong>",
				desc: "Distribute resources from sources to sinks.",
				shipFunction: "dis",
				ooiOptions: [ "neu", "cla" ],
                action: false,
				hullId: 0
			},
            {
                name: "Builder",
                nameActive: "<strong>> Building</strong>",
                desc: "Builds starbases (bab) or develops planets (stb)",
                shipFunction: "bld",
                ooiOptions: [ "bab", "stb" ],
                action: false,
                hullId: 0
            },
			{
				name: "Alchemy",
                nameActive: "<strong>> Brewing</strong>",
				desc: "Load supply and unload products",
				shipFunction: "alc",
				ooiOptions: [ "all", "dur", "tri", "mol" ],
                action: false,
				hullId: 0
			},
			{
				name: "Colonize",
                nameActive: "<strong>> Colonizing</strong>",
				desc: "Colonize unowned planets",
				shipFunction: "exp",
				ooiOptions: [ "slw", "fst" ],
                action: false,
				hullId: 0
			},
            {
                name: "Terraform",
                nameActive: "<strong>> Terraforming</strong>",
                desc: "Terraform planets",
                shipFunction: "ter",
                ooiOptions: [ "cla" ],
                action: false,
                hullId: 0
            },
            {
                name: "Hizzzer",
                nameActive: "<strong>> Hizzzzzing</strong>",
                desc: "MCs Collector using Hizzz",
                shipFunction: "hiz",
                ooiOptions: [ "mcs" ],
                action: false,
                hullId: 0
            },
			{
				name: "Deactivate",
                nameActive: "Deactivate",
				desc: "Deactivate auto-pilot",
				shipFunction: "000",
				ooiOptions: [ false ],
                action: "END",
				hullId: 0
			}
		];
		var curMission = vgap.shipScreen.ship.mission;
        var isAPS = autopilot.isInStorage(vgap.shipScreen.ship.id);

		vgap.more.empty();
        $("<div id='OrdersScreen'><h1>nuPilot-Control</h1></div>").appendTo(vgap.more);
		//
        for (var a = 0; a < apcOptions.length; a++)
		{
            if (this.planet || apcOptions[a].action)
            {
                var c = apcOptions[a];
                var cName = c.name;
                if (isAPS && isAPS.shipFunction === c.shipFunction) cName = c.nameActive;
                // ALCHEMY - only show alchemy module if its an alchemy ship
                if (vgap.shipScreen.ship.hullid !== 105 && c.shipFunction === "alc") continue;
                // TERRAFORM - only show terraform module if its an terraform ship
                if (!vgap.getHull(vgap.shipScreen.ship.hullid).special.match("Terraform Ship") && c.shipFunction === "ter") continue;
                // HIZZZ - only show hizzzer module if it ship has capability
                if ((vgap.player.raceid !== 2 || vgap.shipScreen.ship.beams < 1) && c.shipFunction === "hiz") continue;
                //
                var setShipFunction = function (func, ooiPriority, action) {
                    return function () {
                        var cfgData = {};
                        if (action) // action === "END" => stop APS function
                        {
                            cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                            if (cfgData) {
                                cfgData.action = "END";
                                autopilot.syncLocalStorage(cfgData); // will remove entry and update ship
                                autopilot.clearShipNote(vgap.shipScreen.ship.id);
                            }
                        } else if (func && ooiPriority)
                        {
                            cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                            if (!cfgData) {
                                var baseId = 0;
                                var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                if (planet) baseId = planet.id;
                                var data = {
                                    sid: vgap.shipScreen.ship.id,
                                    base: baseId,
                                    shipFunction: func,
                                    oShipMission: vgap.shipScreen.ship.mission,
                                    ooiPriority: ooiPriority
                                };
                                var newAPS = new APSdata(data);
                                autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData());
                            } else {
                                cfgData.newFunction = func;
                                cfgData.newOoiPriority = ooiPriority;
                                autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData);
                            }
                        }
                        vgap.shipScreen.selectMission(curMission);
                    };
                };
                if (c.ooiOptions.length > 1) {
                    $("<div>" + cName + "<span>" + c.desc + "<br/>Priority: <b id='ooiPriority" + c.shipFunction + "'></b></span></div>").tclick(setShipFunction(false, false, false)).appendTo("#OrdersScreen");
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
                                        oShipMission: vgap.shipScreen.ship.mission,
                                        ooiPriority: ooiPriority
                                    };
                                    var newAPS = new APSdata(data);
                                    autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                                } else {
                                    cfgData.newFunction = func;
                                    cfgData.newOoiPriority = ooiPriority;
                                    autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData); // runs ALL PHASES
                                }
                                return false;
                            };
                        };
                        $("<a style='color:cyan;font-size: 10px;'>" + c.ooiOptions[j] + " </a>").tclick(setShipFunctionOoi(c.shipFunction, c.ooiOptions[j])).appendTo("#ooiPriority" + c.shipFunction);
                    }
                } else {
                    $("<div>" + cName + "<span>" + c.desc + "</span></div>").tclick(setShipFunction(c.shipFunction, c.ooiOptions[0], c.action)).appendTo("#OrdersScreen");
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
            bld: "Build",
			exp: "Colonize",
            ter: "Terraform",
            hiz: "Hizzz-Collect",
			alc: "Alchemy"
		};
        var apcPrio = {};
		apcPrio["col"] =
        {
			all: "Minerals",
			neu: "Neutronium",
			dur: "Duranium",
			tri: "Tritanium",
			mol: "Molybdenum",
            cla: "Clans",
            mcs: "Megacredits",
            sup: "Supplies"
		};
        apcPrio["dis"] =
        {
            neu: "Fuel",
            cla: "Clans"
        };
        apcPrio["bld"] =
        {
            bab: "Starbase",
            stb: "Structures"
        };
        apcPrio["exp"] = {
            slw: "Slow",
            fst: "Fast"
        };
        apcPrio["ter"] = {
            cla: "Planet"
        };
        apcPrio["hiz"] = {
            mcs: "Megacredits"
        };
        apcPrio["alc"] = {
            all: "Minerals",
            dur: "Duranium",
            tri: "Tritanium",
            mol: "Molybdenum"
        };
		var h = "";
		var apcData = autopilot.isInStorage(r.id);
		if (apcData)
		{
		    var ooi = apcData.ooiPriority;
		    if (apcData.currentOoi) ooi = apcData.currentOoi;
			h += "<table width='100%'><tr><td class='widehead' data-topic='ShipAutoPilot'>APC:</td><td class='textval'>";
			h += apcFunctions[apcData.shipFunction] + " " + apcPrio[apcData.shipFunction][ooi];
			h += " <span class='valsup'>(Base: " + apcData.base;
            if (apcData.secondaryDestination) h += " |-(" + apcData.secondaryDestination + ")";
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
        if (vgap.player.raceid !== 12) {
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
     *  DASHBOARD OVERWRITE
     */
	// display NuPilot Information & Settings (Dashboard)
    vgapDashboard.prototype.showNuPilotDeficiencies = function(only)
    {
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Pilots by Base</li>").tclick(function() {
            vgap.dash.showNuPilotsByBase()
        }).appendTo(".FilterMenu");
        $("<li class='SelectedFilter'>Planetary Deficiencies</li>").tclick(function() {
            vgap.dash.showNuPilotDeficiencies()
        }).appendTo(".FilterMenu");

        // load pilots from storage and display...
        var defByPlanet = autopilot.getDeficienciesByPlanet();

        var planetSelector = $("<select id='planetSelect'></select>").appendTo(this.content);
        $("<option value='0'>All Planets</option>").appendTo(planetSelector);
        for (var pid in defByPlanet)
        {
            var p = vgap.getPlanet(pid);
            var selected = "";
            if (pid == only) selected = " selected";
            $("<option value='" + pid + "'" + selected + ">" + p.name + " (" + pid + ")</option>").appendTo(planetSelector);
        }
        $("#planetSelect").change(function() {
            vgap.dash.showNuPilotDeficiencies(this.value)
        });

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='defByPlanet'></div>").appendTo(this.pane);

        for (var pid in defByPlanet)
        {
            if (typeof only === "undefined" || only === 0 || only === pid)
            {
                var planet = vgap.getPlanet(pid);
                var starbase = vgap.getStarbase(pid);
                var sb = "";
                if (starbase) sb = "*sb";
                var h = $("<div>" + pid + ": " + planet.name + " (" + planet.temp + " °C) " + sb + "</div>").appendTo(a);
                var planetInfo = "<div style='font-size: smaller'>Clans: " + planet.clans + " | Fuel: " + planet.neutronium + " | Minerals: " + [planet.duranium, planet.tritanium, planet.molybdenum].join(",");
                planetInfo +=  " | Supply: " + planet.supplies + " | MCs: " + planet.megacredits + "</div>";
                h = $(planetInfo).appendTo(a);
                var container = $("<div style='padding-left: 20px;'></div>").appendTo(a);
                //console.log("[base]");
                //console.log(baseId);
                if (defByPlanet[pid].length > 0)
                {
                    //console.log(defByPlanet[pid]);
                    for (var i = 0; i < defByPlanet[pid].length; i++)
                    {
                        if (defByPlanet[pid][i].defType === "cla")
                        {
                            var population = $("<table width='100%' cellspacing='10'></table>").appendTo(container);
                            $("<tr><th>Buildings</th><th>Req. Labor</th><th>Natives</th><th>Req. Labor</th><th>Colonists</th></tr>").appendTo(population);
                            $("<tr align='center'><td>" + parseInt(planet.factories + planet.mines + planet.defense) + "</td><td>" + defByPlanet[pid][i].buildingsLabor + "</td><td>" + planet.nativeclans + "</td><td>" + defByPlanet[pid][i].nativesLabor.taxation + " | " + defByPlanet[pid][i].nativesLabor.supply + "</td><td>" + planet.clans + " / " + defByPlanet[pid][i].maxClans + "</td></tr>").appendTo(population);
                        } else {
                            var m = $("<table width='100%' cellspacing='10'></table>").appendTo(container);
                            $("<tr><th>Amount</th><th>Type</th></tr>").appendTo(m);
                            var row = "<tr>";
                            row += "<td>" + defByPlanet[pid][i].deficiency + "</td>";
                            row += "<td>" + defByPlanet[pid][i].defType + "</td>";
                            row += "</tr>";
                            $(row).appendTo(m);
                        }
                    }
                }
            }
        }
        this.pane.jScrollPane();
    };
	vgapDashboard.prototype.showNuPilotsByBase = function(only)
    {
        var functions = {
            col: "Collect",
            dis: "Distribute",
            exp: "Expand",
            alc: "Alchemy"
        };
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");
        $("<li class='SelectedFilter'>Pilots by Base</li>").tclick(function() {
            vgap.dash.showNuPilotsByBase()
        }).appendTo(".FilterMenu");
        $("<li>Planetary Deficiencies</li>").tclick(function() {
            vgap.dash.showNuPilotDeficiencies()
        }).appendTo(".FilterMenu");

        // load pilots from storage and display...
        var apsByBase = autopilot.getAPSbyBase();

        var baseSelector = $("<select id='baseSelect'></select>").appendTo(this.content);
        $("<option value='0'>All Bases</option>").appendTo(baseSelector);
        for (var bId in apsByBase)
        {
            var bP = vgap.getPlanet(bId);
            var selected = "";
            if (bId === only) selected = " selected";
            $("<option value='" + bId + "'" + selected + ">" + bP.name + " (" + bId + ")</option>").appendTo(baseSelector);
        }
        $("#baseSelect").change(function() {
            vgap.dash.showNuPilotsByBase(this.value)
        });

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='pilotsByBase'></div>").appendTo(this.pane);

        for (var baseId in apsByBase)
        {
            if (typeof only === "undefined" || only === 0 || only === baseId)
            {
                var basePlanet = vgap.getPlanet(baseId);
                var claDef = autopilot.getClanDeficiency(basePlanet);
                if (claDef > 0) claDef = "+" + claDef;
                var starbase = vgap.getStarbase(baseId);
                // Header
                var header = $("<div style='border-bottom: 1px solid white;'></div>").appendTo(a);
                $("<span style='font-size: large;'>" + baseId + ": " + basePlanet.name + " - (" + basePlanet.temp + " °C)" + "</span>").appendTo(header);
                // Planet Info
                var pInfoTable = $("<table class='CleanTable' width='100%' cellspacing='10'></table>").appendTo(a);
                $("<tr><td>Temperature</td><td>" + basePlanet.temp + " °C</td><tr>").appendTo(pInfoTable);
                $("<tr><td>Clans</td><td>" + basePlanet.clans + " (" + claDef + ")</td><tr>").appendTo(pInfoTable);
                $("<tr><td>Supply</td><td>" + basePlanet.supplies + "</td><tr>").appendTo(pInfoTable);
                $("<tr><td>Megacredits</td><td>" + basePlanet.megacredits + "</td><tr>").appendTo(pInfoTable);
                $("<tr><td>Fuel</td><td>" + basePlanet.neutronium + "</td><tr>").appendTo(pInfoTable);
                $("<tr><td>Minerals</td><td>" + [basePlanet.duranium, basePlanet.tritanium, basePlanet.molybdenum].join("/") + "</td><tr>").appendTo(pInfoTable);
                // Starbase Info
                if (starbase)
                {
                    var baseDef = autopilot.getBaseDeficiency(basePlanet);
                    $("<div style='font-size: medium;padding-top:10px;border-bottom: 1px dashed white;'>Starbase</div>").appendTo(a);
                    $("<div style='font-size: smaller;'>Technology: " + starbase.hulltechlevel + " / " + starbase.enginetechlevel + " / " + starbase.beamtechlevel + " / " + starbase.torptechlevel + "</div>").appendTo(a);
                    $("<div style='font-size: smaller;'>Megacredits: " + baseDef.mcs + "</div>").appendTo(a);
                    $("<div style='font-size: smaller;'>Minerals: " + baseDef.dur + " / " + baseDef.tri + " / " + baseDef.mol + "</div>").appendTo(a);
                }
                // APS Info
                var oirs = autopilot.getSumOfObjectsInRange(basePlanet, 81);
                var oird = autopilot.getSumOfObjectsInRange(basePlanet, 162);
                $("<div style='font-size: medium;padding-top:10px;border-bottom: 1px dashed white;'>APS Base</div>").appendTo(a);
                var baseInfoTable = $("<table class='CleanTable' width='100%' cellspacing='10'></table>").appendTo(a);
                $("<tr><th>Range</th><th>Planets</th><th>Clans</th><th>Neu</th><th>Dur</th><th>Tri</th><th>Mol</th><th>Mcs</th><th>Sup</th></tr>").appendTo(baseInfoTable);
                $("<tr align='center'><td>" + oirs.range + " lj</td><td>" + oirs.planets + "</td><td>" + oirs.cla + "</td><td>" + oirs.neu + " (" + oirs.gneu + ")</td><td>" + oirs.dur + " (" + oirs.gdur + ")</td><td>" + oirs.tri + " (" + oirs.gtri + ")</td><td>" + oirs.mol + " (" + oirs.gmol + ")</td><td>" + oirs.mcs + "</td><td>" + oirs.sup + "</td></tr>").appendTo(baseInfoTable);
                $("<tr align='center'><td>" + oird.range + " lj</td><td>" + oird.planets + "</td><td>" + oird.cla + "</td><td>" + oird.neu + " (" + oird.gneu + ")</td><td>" + oird.dur + " (" + oird.gdur + ")</td><td>" + oird.tri + " (" + oird.gtri + ")</td><td>" + oird.mol + " (" + oird.gmol + ")</td><td>" + oird.mcs + "</td><td>" + oird.sup + "</td></tr>").appendTo(baseInfoTable);
                //
                $("<div style='font-size: medium;padding-top:10px;border-bottom: 1px dashed white;'>Active Autopilots</div>").appendTo(a);
                var container = $("<div style='padding-left: 20px;'></div>").appendTo(a);
                var m = $("<table class='CleanTable' width='100%' cellspacing='10'></table>").appendTo(container);
                $("<tr><th>Ship</th><th>Mission</th><th>Sec. Dest.</th><th>Dest.</th><th>Position</th><th>Idle</th></tr>").appendTo(m);
                //console.log("[base]");
                //console.log(baseId);
                if (apsByBase[baseId].length > 0)
                {
                    for (var i = 0; i < apsByBase[baseId].length; i++)
                    {
                        //console.log("[aps]");
                        //console.log(apsByBase[baseId][i]);
                        var ship = vgap.getShip(apsByBase[baseId][i].sid);
                        var shipPlanet = vgap.planetAt(ship.x, ship.y);
                        var position = "@ " + ship.x + " / " + ship.y;
                        if (shipPlanet)
                        {
                            if (shipPlanet.id == baseId)
                            {
                                position = "@ home";
                            } else
                            {
                                position = "@ " + shipPlanet.name + " (" + shipPlanet.id + ")";
                            }
                        }
                        var hull = vgap.getHull(ship.hullid);
                        var row = "<tr>";
                        row += "<td>" + hull.name + " (" + apsByBase[baseId][i].sid + ")</td>";
                        row += "<td align='center'>" + functions[apsByBase[baseId][i].shipFunction] + " (" + apsByBase[baseId][i].ooiPriority + ")</td>";
                        var secDest = apsByBase[baseId][i].secondaryDestination;
                        if (!apsByBase[baseId][i].secondaryDestination) secDest = "-";
                        row += "<td align='center'>" + secDest + "</td>";
                        row += "<td align='center'>" + apsByBase[baseId][i].destination + "</td>";
                        row += "<td align='center'>" + position + "</td>";
                        row += "<td align='center'>" + apsByBase[baseId][i].idle + "</td>";
                        row += "</tr>";
                        $(row).appendTo(m);
                    }
                }
                $("<div style='padding-bottom:20px;'><hr></div>").appendTo(a);
            }
        }
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.saveNuPilotCollectorSettings = function()
    {
        var nupSettings = autopilot.loadGameSettings();
        if ($( "#autoRange" ).prop( "checked" ))
        {
            nupSettings.colScopeRange = "auto";
        } else
        {
            var input = parseFloat($( "#autoRange" ).val());
            nupSettings.colScopeRange = input;
        }
        var input = parseFloat($( "#minResolve" ).val());
        if (input > 1) input = Math.round((input / 100) * 10) / 10;
        nupSettings.colMinCapacity = $( "#minResolve" ).val();
        autopilot.saveGameSettings(nupSettings);
        vgap.dash.showNuPilotGeneralSettings();
    };
    vgapDashboard.prototype.showNuPilotCollectorSettings = function()
    {
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li>General Settings</li>").tclick(function() {
            vgap.dash.showNuPilotGeneralSettings()
        }).appendTo(".FilterMenu");
        $("<li class='SelectedFilter'>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");

        // load settings from storage and display...
        var nupSettings = autopilot.loadGameSettings();
        console.log(nupSettings);

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='colSettings'></div>").appendTo(this.pane);
        // Intro
        $("<div>A nuPilot collector once activated considers the current planet as his base and will collect one specific resource or focus on building minerals ('all').</div>").appendTo(a);
        // Settings
        var ul = $("<ul></ul>").appendTo(a);
        // scope range
        var scopeRange = nupSettings.colScopeRange;
        var checked = "";
        var rangeValue = scopeRange;
        if (scopeRange === "auto") {
            checked = "checked";
            rangeValue = "";
        }
        $("<li>Scope Range: The radius in which the nuPilot will look for resources.</li>").appendTo(ul);
        var scopeRangeUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='autoRange'>Auto:</label><input type='checkbox' id='autoRange' " + checked + "> or <label for='range'>Range:</label><input type='text' id='range' value='" + rangeValue + "'></li>").appendTo(scopeRangeUL);
        // minimum resolve factor
        var minCapacity = nupSettings.colMinCapacity;
        $("<li>Minimum Capacity: The minimum capacity (cargo / fuel / megacredits) a nuPilot should use for a mission. 1 for 100 % (only collect full cargo loads), 0.9 for 90 %, etc.</li>").appendTo(ul);
        var minResolveUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='minResolve'>Minimum Capacity:</label><input type='text' id='minResolve' value='" + minCapacity + "'></li>").appendTo(minResolveUL);
        // save button
        var ul = $("<button onclick='vgap.dash.saveNuPilotCollectorSettings();'>Save</button>").appendTo(a);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.saveNuPilotGeneralSettings = function()
    {
        var nupSettings = autopilot.loadGameSettings();
        nupSettings.planetGFX = $( "#pGFX" ).prop( "checked" );
        nupSettings.shipGFX = $( "#sGFX" ).prop( "checked" );
        //
        nupSettings.defMcsRetention = $( "#defMcsRetention" ).val();
        nupSettings.sbMcsRetention = $( "#sbMcsRetention" ).val();
        nupSettings.defSupRetention = $( "#defSupRetention" ).val();
        nupSettings.sbSupRetention = $( "#sbSupRetention" ).val();
        nupSettings.defNeuRetention = $( "#defNeuRetention" ).val();
        nupSettings.sbNeuRetention = $( "#sbNeuRetention" ).val();
        nupSettings.frtNeuRetention = $( "#frtNeuRetention" ).val();
        //
        nupSettings.planetMNG = $( "#pMNG" ).prop( "checked" );
        nupSettings.defPlanetDef = $( "#pMNGdefDef" ).val();
        nupSettings.defPlanetSbDef = $( "#pMNGaddSbDef" ).val();
        nupSettings.defPlanetFortDef = $( "#pMNGaddFrtDef" ).val();
        //
        autopilot.saveGameSettings(nupSettings);
        vgap.dash.showNuPilotGeneralSettings();
    };
    vgapDashboard.prototype.showNuPilotGeneralSettings = function()
    {
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li class='SelectedFilter'>General Settings</li>").tclick(function() {
            vgap.dash.showNuPilotGeneralSettings()
        }).appendTo(".FilterMenu");
        $("<li>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");
        /*$("<li>Pilots by Base</li>").tclick(function() {
            vgap.dash.showNuPilotsByBase()
        }).appendTo(".FilterMenu"); */

        // load settings from storage and display...
        var nupSettings = autopilot.loadGameSettings();
        //console.log(nupSettings);
        var planetGFX = nupSettings.planetGFX;
        var shipGFX = nupSettings.shipGFX;
        var checked = "";

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='genSettings'><hr></div>").appendTo(this.pane);
        var ul = $("<ul></ul>").appendTo(a);

        // turn on / off planetary indicators
        $("<li>Display planetary info and indicators: </li>").appendTo(ul);
        var pGFXul = $("<ul></ul>").appendTo(ul);
        if (planetGFX) checked = "checked";
        $("<li><label for='pGFX'>On</label><input type='checkbox' id='pGFX' " + checked + "></li>").appendTo(pGFXul);
        checked = "";

        // turn on / off ship indicators
        $("<li>Display ship indicators: </li>").appendTo(ul);
        var sGFXul = $("<ul></ul>").appendTo(ul);
        if (shipGFX) checked = "checked";
        $("<li><label for='sGFX'>On</label><input type='checkbox' id='sGFX' " + checked + "></li>").appendTo(sGFXul);
        checked = "";

        var planetMng = nupSettings.planetMNG;
        var pDefDef = nupSettings.defPlanetDef;
        var pSbDefDef = nupSettings.defPlanetSbDef;
        var pFortDefDef = nupSettings.defPlanetFortDef;
        // turn on / off planetary manager
        $("<li>Planetary manager (sets taxes, build targets and builds structures): </li>").appendTo(ul);
        var pMNGul = $("<ul></ul>").appendTo(ul);
        if (planetMng) checked = "checked";
        $("<li><label for='pMNG'>On</label><input type='checkbox' id='pMNG' " + checked + "></li>").appendTo(pMNGul);
        var pMNGOptionsUl = $("<ul></ul>").appendTo(pMNGul);
        $("<li><label for='pMNGdefDef'>Default planetary defense</label>: <input type='text' id='pMNGdefDef' value='" + pDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);
        $("<li><label for='pMNGaddSbDef'>Additional defense for planets with starbase</label>: <input type='text' id='pMNGaddSbDef' value='" + pSbDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);
        $("<li><label for='pMNGaddFrtDef'>Additional defense for fortified planets</label>: <input type='text' id='pMNGaddFrtDef' value='" + pFortDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);

        // Retention Settings
        var dMR = nupSettings.defMcsRetention; // default megacredit retention
        var sbMR = nupSettings.sbMcsRetention; // default megacredit retention @ starbase
        var dSR = nupSettings.defSupRetention; // default supplies retention
        var sbSR = nupSettings.sbSupRetention; // default supplies retention @ starbase
        var dNR = nupSettings.defNeuRetention; // default fuel retention
        var sbNR = nupSettings.sbNeuRetention; // default fuel retention @ starbase
        var fNR = nupSettings.frtNeuRetention; // default fuel retention @ fort

        var hr2 = $("<div><hr></div>").appendTo(this.pane);
        $("<h3>Retention Values</h3>").appendTo(hr2);
        var table = $("<table></table>").appendTo(hr2);
        var tr = $("<tr></tr>").appendTo(table);
        var td = $("<td width='20%'></td>").appendTo(tr);
        $("<div>How much of ... should be retained @planet, @fortified planet or @starbase planet? " +
            "<br>Collectors and Distributors will respect these values in terms of cargo. When it comes to using fuel (Neutronium), corresponding retention values are ignored." +
            "<br>Expanders and Builders only adhere to the default (@planet) retention values.</div>").appendTo(td);

        var td2 = $("<td></td>").appendTo(tr);
        var table2 = $("<table></table>").appendTo(td2);
        $("<tr><td><label for='defMcsRetention'>Megacredits:</label></td><td><input type='text' id='defMcsRetention' value='" + dMR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbMcsRetention'></label></td><td><input type='text' id='sbMcsRetention' value='" + sbMR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);
        $("<tr><td><label for='defSupRetention'>Supply:</label></td><td><input type='text' id='defSupRetention' value='" + dSR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbSupRetention'></label></td><td><input type='text' id='sbSupRetention' value='" + sbSR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);
        $("<tr><td><label for='defNeuRetention'>Neutronium:</label></td><td><input type='text' id='defNeuRetention' value='" + dNR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='frtNeuRetention'></label></td><td><input type='text' id='frtNeuRetention' value='" + sbNR + "' style='width: 50px;'></td><td>@Fort</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbNeuRetention'></label></td><td><input type='text' id='sbNeuRetention' value='" + fNR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);

        var hr3 = $("<div><hr></div>").appendTo(this.pane);
        // save button
        var ul = $("<button onclick='vgap.dash.saveNuPilotGeneralSettings();'>Save</button>").appendTo(hr3);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.saveNuPilotDistributorSettings = function()
    {
        var nupSettings = autopilot.loadGameSettings();
        if ($( "#autoRange" ).prop( "checked" ))
        {
            nupSettings.disScopeRange = "auto";
        } else
        {
            var input = parseFloat($( "#autoRange" ).val());
            nupSettings.disScopeRange = input;
        }
        var input = parseFloat($( "#minResolve" ).val());
        if (input > 1) input = Math.round((input / 100) * 10) / 10;
        nupSettings.disMinCapacity = $( "#minResolve" ).val();
        autopilot.saveGameSettings(nupSettings);
        vgap.dash.showNuPilotGeneralSettings();
    };
    vgapDashboard.prototype.showNuPilotDistributorSettings = function()
    {
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li>General Settings</li>").tclick(function() {
            vgap.dash.showNuPilotGeneralSettings()
        }).appendTo(".FilterMenu");
        $("<li>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li class='SelectedFilter'>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");

        // load settings from storage and display...
        var nupSettings = autopilot.loadGameSettings();

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='colSettings'></div>").appendTo(this.pane);
        // Intro
        $("<div>A nuPilot distributor once activated will start to distribute one specific resource or everything possible using clan deficiencies as primer.</div>").appendTo(a);
        // Settings
        var ul = $("<ul></ul>").appendTo(a);
        // scope range
        var scopeRange = nupSettings.disScopeRange;
        var checked = "";
        var rangeValue = scopeRange;
        if (scopeRange === "auto") {
            checked = "checked";
            rangeValue = "";
        }
        $("<li>Scope Range: The radius in which the nuPilot will look for resources.</li>").appendTo(ul);
        var scopeRangeUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='autoRange'>Auto:</label><input type='checkbox' id='autoRange' " + checked + "> or <label for='range'>Range:</label><input type='text' id='range' value='" + rangeValue + "'></li>").appendTo(scopeRangeUL);
        // minimum resolve factor
        var minCapacity = nupSettings.disMinCapacity;
        $("<li>Minimum Capacity: The minimum capacity (cargo / fuel / megacredits) a nuPilot should use for a mission. 1 for 100 % (only distribute full cargo loads), 0.9 for 90 %, etc.</li>").appendTo(ul);
        var minResolveUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='minResolve'>Minimum Capacity:</label><input type='text' id='minResolve' value='" + minCapacity + "'></li>").appendTo(minResolveUL);
        // save button
        var ul = $("<button onclick='vgap.dash.saveNuPilotCollectorSettings();'>Save</button>").appendTo(a);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.showNuPilotDash = function()
    {
        vgap.playSound("button");
        this.content.empty();
        //
        this.dipMenu();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li class='SelectedFilter'>General Settings</li>").tclick(function() {
            vgap.dash.showNuPilotGeneralSettings()
        }).appendTo(".FilterMenu");
        $("<li>Collector Settings</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        $("<li>General Settings</li>").tclick(function() {
            vgap.dash.showNuPilotGeneralSettings()
        }).appendTo(".FilterMenu");
        $("<li>Distributor Settings</li>").tclick(function() {
            vgap.dash.showNuPilotDistributorSettings()
        }).appendTo(".FilterMenu");
        $("<li>Pilots by Base</li>").tclick(function() {
            vgap.dash.showNuPilotsByBase()
        }).appendTo(".FilterMenu");
        $("<li>Planetary Deficiencies</li>").tclick(function() {
            vgap.dash.showNuPilotDeficiencies();
        }).appendTo(".FilterMenu");
        //
        this.pane = $("<div class='DashPane'>Settings & Infos.</div>").appendTo(this.content);
        vgap.dash.showNuPilotGeneralSettings();
        this.pane.jScrollPane();
    };


	// register your plugin with NU
	vgap.registerPlugin(autopilot, "autopilotPlugin");
	console.log("nuPilot plugin registered");
} //wrapper for injection

var script = document.createElement("script");
script.type = "application/javascript";
script.textContent = "(" + wrapper + ")();";

document.body.appendChild(script);