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
// @version       0.13.01
// @date          2018-07-28
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
        //
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
        this.curFuelFactor = 0;
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
        this.scopeRange = Math.pow(this.ship.engineid, 2); // default scope range for all APS, changed by functionModules
        this.simpleRange = Math.pow(this.ship.engineid, 2); // max warp turn distance
        //
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
        this.objectOfInterest = false;
        //
        this.storedData = false; // stored data of APS
        this.enemyPlanets = this.getCloseEnemyPlanets(); // enemy planets within a range of 200 ly
        this.enemyShips = this.getCloseEnemyShips(); // enemy ships within a range of 200 ly
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
    /*
     * METHODS
     */
    APS.prototype.initializeBoardComputer = function(configuration)
    {
        console.error("Initializing flight computer of APC " + this.ship.id);
        this.setMissionAttributes(configuration);
        this.setShipAttributes(configuration);
        this.setPositionAttributes(configuration);
        //
        // initialize ship function module
        //
        this.bootFunctionModule(configuration.shipFunction);
        this.setFunctionAttributes();
        //
        this.initAPScontrol(); // get apsBy... collections
        //
        if (this.destination)
        {
            if (!this.planet && this.getMissionConflict(this.destination))
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
                // if we are at the destination, clear destination setting
                if (this.planet.id === this.destination.id && !this.secondaryDestination)
                {
                    console.log("...planet is destination, update configuration.");
                    if (this.functionModule.missionCompleted(this))
                    {
                        console.log("...mission completed, update configuration.");
                        configuration.lastDestination = this.destination.id;
                        configuration.destination = false;
                        configuration.secondaryDestination = false;
                        configuration.idle = false;
                        configuration.idleReason = [];
                        configuration.idleTurns = 0;
                        // if new behaviour is requested, now is the time for change
                        if (configuration.newFunction)
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
                    } else
                    {
                        console.log("...mission inccomplete! Due for mission update.");
                        this.functionModule.setSecondaryDestination(this);
                        console.log("...setting next Target.");
                        this.setShipTarget();
                    }
                } else if (this.secondaryDestination && this.planet.id === this.secondaryDestination.id)
                {
                    console.log("...planet is 2ndary destination, update configuration.");
                    configuration.lastDestination = this.secondaryDestination.id;
                    configuration.secondaryDestination = false;
                    if (configuration.shipFunction === "exp") this.hasToSetPotDes = true; // expander will set new destination after re-supplying
                    this.setMissionAttributes(configuration);
                    console.log("...setting next Target.");
                    this.setShipTarget();
                } else if (!this.destination) {
                    // seems destination was reset, we need to find a new one
                    this.hasToSetPotDes = true;
                } else
                {
                    console.log("...planet is no destination.");
                    console.log("...setting next Target.");
                    this.setShipTarget();
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
                    let wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
                    if (wpP) this.waypoint = wpP;
                } else {
                    // no target is set...
                    console.log("...setting next Target.");
                    this.setShipTarget();
                }
            }
        } else
        {
            console.log("...no destination set.");
            console.log("...scheduled for potential destination determination.");
            this.hasToSetPotDes = true;  // will determine potDest, select destination and set next target
        }
    };
    APS.prototype.bootFunctionModule = function(func)
    {
        if (func === "col")
        {
            console.log("...Collector Mode (" + this.objectOfInterest + ")");
            this.functionModule = new CollectorAPS(this);
            console.log(this.functionModule);
        } else if (func === "dis")
        {
            console.log("...Distributer Mode (" + this.objectOfInterest + ")");
            this.functionModule = new DistributorAPS(this);
        } else if (func === "bld")
        {
            console.log("...Builder Mode (" + this.objectOfInterest + ")");
            this.functionModule = new BuilderAPS(this);
        } else if (func === "alc")
        {
            console.log("...Alchemy Mode (" + this.objectOfInterest + ")");
            this.functionModule = new AlchemyAPS(this);
        } else if (func === "exp")
        {
            console.log("...Expander Mode (" + this.objectOfInterest + ")");
            this.functionModule = new ExpanderAPS(this);
        } else if (func === "ter")
        {
            console.log("...Terraformer Mode");
            this.functionModule = new TerraformerAPS(this);
        } else if (func === "hiz")
        {
            console.log("...Hizzz Mode");
            this.functionModule = new HizzzAPS(this);
        } else
        {
            this.isAPS = false;
        }
    };
    /*
     * CONFIGURATION
     */
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
        this.curFuelFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp]; // currently applicable fuel factor
        if (this.hull.special && this.hull.special.match(/Gravitonic/)) this.gravitonic = true;
        if (this.hull.special && this.hull.special.match(/Radiation Shielding/)) this.radiationShielding = true;
        if (this.hull.special && this.hull.special.match(/Terraform/) && this.hull.special.match(/lower\splanet\stemperature/)) this.terraCooler = true;
        if (this.hull.special && this.hull.special.match(/Terraform/) && this.hull.special.match(/raise\splanet\stemperature/)) this.terraHeater = true;
        this.inWarpWell = this.isInWarpWell( { x: this.ship.x, y: this.ship.y } );
        if (this.inWarpWell) this.planet = false;
        this.setConventionalShipMission(cfg);
        this.setRange();
    };
    APS.prototype.setRange = function()
    {
        this.simpleRange = Math.pow(this.ship.engineid, 2); // max turn distance with max efficient warp (=engineid)
        if (this.gravitonic) this.simpleRange *= 2;
    };
    APS.prototype.setConventionalShipMission = function(cfg)
    {
        this.oShipMission = cfg.oShipMission;
        if (this.oShipMission && this.oShipMission !== this.ship.mission)
        {
            if (this.ship.mission !== 8 && this.ship.mission !== 2) this.ship.mission = this.oShipMission;
        } // reset mission to original setting (= when autopilot was activated) if ship is not set to (web)mine laying
        //if (vgap.player.raceid === 2 && this.ship.beams > 0) { this.ship.mission = 8; } // if lizard, set HISS mission
        if (this.hull.cancloak) this.ship.mission = 9; // cloak if possible
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
        if (this.primaryFunction === "hiz" && this.planet && autopilot.hizzzerPlanets.indexOf(this.planet.id) === -1) autopilot.hizzzerPlanets.push(this.planet.id);
        this.objectOfInterest = cfg.ooiPriority;
        if (cfg.destination && !this.destination)
        {
            this.destination = vgap.getPlanet(cfg.destination);
        } else if (!cfg.destination)
        {
            this.destination = false;
        }
        if (this.destination && !this.isValidDestination(this.destination.id)) this.destination = false; // e.g. is destination (still) our planet
        if (cfg.secondaryDestination) this.secondaryDestination = vgap.getPlanet(cfg.secondaryDestination);
        if (cfg.secondaryDestination === false || (this.secondaryDestination && !this.isValidDestination(this.secondaryDestination.id))) this.secondaryDestination = false; // e.g. is destination (still) our planet
        if (this.destination && this.secondaryDestination && this.destination.id === this.secondaryDestination.id) this.secondaryDestination = false; // toDo: should not happen, but did happen
        if (cfg.lastDestination) this.lastDestination = vgap.getPlanet(cfg.lastDestination);
    };
    APS.prototype.setFunctionAttributes = function()
    {
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
        }
    };
    /*
     *  SHIP
     */
    APS.prototype.isMakingTorpedoes = function()
    {
        let s = this.ship;
        return (s.friendlycode.toUpperCase() === "MKT" && s.megacredits > 0 && s.duranium > 0 && s.tritanium > 0 && s.molybdenum > 0);
    };
    APS.prototype.getCurCapacity = function(object)
    {
        if (typeof object === "undefined") object = "other";
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
        let cargoCapacity = this.hull.cargo;
        //console.log("cargoCapacity = " + cargoCapacity);
        let components = [
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
    /*
     *  APS CONTROL // toDo: find another solution (e.g. APS-Control Object created in autopilot)
     */
    APS.prototype.initAPScontrol = function()
    {
        this.apcByBase = {};
        this.apcByDest = {};
        this.apcBySecDest = {};
        this.apcByShip = {};
        let apsData = autopilot.loadGameData();
        for (let i = 0; i < apsData.length; i++)
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
                if (apsData[i].secondaryDestination && typeof this.apcBySecDest[apsData[i].secondaryDestination] === "undefined") this.apcBySecDest[apsData[i].secondaryDestination] = [];
                if (apsData[i].secondaryDestination) this.apcBySecDest[apsData[i].secondaryDestination].push({
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
        //console.log("APC By Secondary Destination");
        //console.log(this.apcBySecDest);
    };
    APS.prototype.isAPSbase = function(pid)
    {
        return (this.apcBaseIds.indexOf(pid) > -1);
    };
    APS.prototype.destinationHasSameAPStype = function(pid, sf, ooi, secondary)
    {
        if (typeof sf === "undefined") sf = this.primaryFunction;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        if (typeof secondary === "undefined") secondary = false;
        let pool;
        if (secondary)
        {
            pool = this.apcBySecDest;
            //console.log("Is planet " + pid + " a secondary destination for another APS of the same type?");
        } else
        {
            pool = this.apcByDest;
            //console.log("Is planet " + pid + " a destination for another APS of the same type?");
        }
        if (typeof pool[pid] === "undefined") {
            //console.log("...no APS assigned to planet!");
            return false;
        }
        let conflictAPS = [];
        for (let i = 0; i < pool[pid].length; i++)
        {
            let cAPS = pool[pid][i];
            if (cAPS.sid === this.ship.id) continue; // exclude current APS
            if (cAPS.shipFunction === sf)
            {
                //console.log("...APS with same function registered!");
                if (cAPS.ooiPriority === ooi || cAPS.shipFunction === "exp")
                {
                    //console.log("...APS has same OOI!");
                    conflictAPS.push(cAPS);
                }
            }
        }
        if (conflictAPS.length > 0) {
            console.log("APS.destinationHasSameAPStype: %s", pid, conflictAPS);
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
        for (let i = 0; i < this.apcByBase[pid].length; i++)
        {
            if (this.apcByBase[pid][i].sid === this.ship.id) continue;
            if (this.apcByBase[pid][i].shipFunction === sf && this.apcByBase[pid][i].ooiPriority === ooi) return true;
        }
        return false;
    };
    /*
     *  LOCATION
     */
    APS.prototype.objectInRangeOfEnemyShip = function(object)
    {
        let sAt = vgap.shipsAt(object.x, object.y);
        let eAtP = false;
        if (sAt.length > 0)
        {
            sAt.forEach(function (s) {
                if (s.ownerid !== vgap.player.id) eAtP = true;
            });
        }
        if (eAtP) return true;
        //
        let eS = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyShips, this.enemySafetyZone, object);
        // avoid planets in close proximity of enemy ships
        for (let j = 0; j < eS.length; j++)
        {
            // only when ship has weapons toDo: or when ship is capable of robbing?
            if (eS[j].armed)
            {
                // check if object is farther away from enemy than current location
                let objectEnemyDist = Math.ceil(autopilot.getDistance( {x: object.x, y: object.y}, {x: eS[j].x, y: eS[j].y} ));
                let apsEnemyDist = Math.ceil(autopilot.getDistance( {x: this.ship.x, y: this.ship.y}, {x: eS[j].x, y: eS[j].y} ));
                if (objectEnemyDist < apsEnemyDist) return true;
            }
        }
        return false;
    };
    APS.prototype.objectInRangeOfEnemyPlanet = function (object)
    {
        let eP = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyPlanets, this.enemySafetyZone, object);
        return (eP.length > 0);
    };
    APS.prototype.objectInRangeOfEnemy = function(object)
    {
        return (this.objectInRangeOfEnemyPlanet(object) || this.objectInRangeOfEnemyShip(object));
    };
    APS.prototype.isInWarpWell = function(coords)
    {
        if (typeof coords === "undefined") coords = { x: this.ship.x, y: this.ship.y };
        let planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        let cP = autopilot.getClosestPlanet(coords, 0, true);
        if (cP)
        {
            return autopilot.positionIsInWarpWellOfPlanet(cP.planet, coords);
        } else {
            console.error("...no closest planet found???");
            return false;
        }
    };
    APS.prototype.shipTargetInWarpWell = function(s)
    {
        if (typeof s === "undefined") s = this.ship;
        let planet = vgap.planetAt(s.targetx, s.targety);
        if (planet) return false; // target is planet
        let cP = autopilot.getClosestPlanet({x: s.targetx, y: s.targety}, 0, true);
        if (cP)
        {
            return autopilot.positionIsInWarpWellOfPlanet(cP.planet, {x: s.targetx, y: s.targety});
        } else {
            console.error("...no closest planet found???");
            return false;
        }
    };
    APS.prototype.getPositions4Ships = function(sids)
    {
        let frnnPositions = [];
        for(let i = 0; i < sids.length; i++)
        {
            let s = vgap.getShip(sids[i]);
            if (s) frnnPositions.push( { x: s.x , y: s.y } );
        }
        return frnnPositions;
    };
    APS.prototype.getPositions4Planets = function(pids)
    {
        let frnnPositions = [];
        for(let i = 0; i < pids.length; i++)
        {
            let p = vgap.getPlanet(pids[i]);
            frnnPositions.push( { x: p.x , y: p.y } );
        }
        return frnnPositions;
    };
    APS.prototype.getDistanceToEnemyPlanet = function()
    {
        if (this.enemyPlanets)
        {
            this.enemyPlanets.sort(function (a, b) { return a.distance - b.distance; });
            return this.enemyPlanets[0].distance;
        } else
        {
            return false;
        }
    };
    APS.prototype.getCloseEnemyPlanets = function()
    {
        // only consider planets inside a safety zone (i.e. 162 ly)
        let s = this.ship;
        let closeEnemyPlanets = autopilot.getTargetsInRange(autopilot.frnnEnemyPlanets, s.x, s.y, 162);
        if (closeEnemyPlanets.length > 0)
        {
            closeEnemyPlanets.forEach(
                function (eP, idx) {
                    closeEnemyPlanets[idx].distance = Math.floor(autopilot.getDistance( { x: s.x, y: s.y }, { x: eP.x ,y: eP.y } ));
                }
            );
            return closeEnemyPlanets;
        } else
        {
            return false;
        }
    };
    APS.prototype.getDistanceToEnemyShip = function()
    {
        if (this.enemyShips)
        {
            this.enemyShips.sort(function (a, b) { return a.distance - b.distance; });
            return this.enemyShips[0].distance;
        } else
        {
            return false;
        }
    };
    APS.prototype.getCloseEnemyShips = function()
    {
        // only consider ships inside a safety zone (i.e. 162 ly)
        let s = this.ship;
        let closeEnemyShips = autopilot.getTargetsInRange(autopilot.frnnEnemyShips, s.x, s.y, 162);
        if (closeEnemyShips.length > 0)
        {
            closeEnemyShips.forEach(
                function (eP, idx) {
                    closeEnemyShips[idx].distance = Math.floor(autopilot.getDistance( { x: s.x, y: s.y }, { x: eP.x ,y: eP.y } ));
                }
            );
            return closeEnemyShips;
        } else
        {
            return false;
        }
    };
    /*
     *  MOVEMENT
     */
    APS.prototype.getRandomWarpWellEntryPosition = function ()
    {
        if (this.planet)
        {
            // warp well entry from planet
            let p = this.planet;
            let coords = [
                { x: p.x - 1, y: p.y + 1},
                { x: p.x, y: p.y + 1},
                { x: p.x + 1, y: p.y + 1},
                { x: p.x - 1, y: p.y},
                { x: p.x + 1, y: p.y},
                { x: p.x - 1, y: p.y - 1},
                { x: p.x, y: p.y - 1},
                { x: p.x + 1, y: p.y - 1}
            ]; // 8 positions (0-7)
            let pick = Math.floor(Math.random() * 10);
            if (pick > 7) pick = Math.floor(pick / 2);
            return coords[pick];
        } else
        {
            // toDo: warp well entry from space
            return { x: this.ship.x, y: this.ship.y };
        }
    };
    /*
        APS.estimateNextFuelConsumption
         from (targetPlanet) -> next Destination
         using direct routes:
            ship -> (destination) -> new destination
            ship -> (secondary destination) -> primary destination

     */
    APS.prototype.estimateNextFuelConsumption = function(tP)
    {
        let nextFuel = false;
        let curDistance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: this.ship.x, y: this.ship.y }));
        let thisFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, [], curDistance); // [] = current cargo
        if (this.ship.hullid === 96) thisFuel -= (2 * (curDistance - 1)); // cobol ramscoop
        let nextMissionTarget = false;
        let nextCargo = [];
        if (this.destination.id === tP.id || (this.secondaryDestination && this.secondaryDestination.id === tP.id))
        {
            nextMissionTarget = this.getNextMissionTarget(tP); // this is either a new secondary or primary destination or the next waypoint
            nextCargo = this.estimateMissionCargo(tP, nextMissionTarget);
        } else
        {
            if (this.secondaryDestination)
            {
                nextMissionTarget = this.secondaryDestination;
            } else {
                nextMissionTarget = this.destination;
            }
        }
        if (nextMissionTarget)
        {
            this.setWaypoints(tP, nextMissionTarget); // tP = next ship position
            let nWP = this.getNextWaypoint(nextMissionTarget, tP);
            console.log("APS.estimateNextFuelConsumption: next waypoint:", nWP);
            if (nWP)
            {
                let distance = Math.ceil(autopilot.getDistance({ x: tP.x, y: tP.y }, { x: nWP.x, y: nWP.y }));
                nextFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, nextCargo, distance);
                if (this.ship.hullid === 96) nextFuel -= (2 * (distance-1)); // cobol ramscoop
            }
        }
        if (!nextFuel) return thisFuel; // as precaution, if no next fuel could be determined, return consumption of prior (this) trip
        return nextFuel;
    };
    APS.prototype.checkFuel = function(cargo)
    {
        console.log("::>checkFuel");
        //if (typeof this.planet === "undefined") return true;
        if (typeof cargo === "undefined") cargo = [];
        this.setWarp(); // set warp factor according to current circumstances
        let fuel = Math.ceil(autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, cargo));
        if (!fuel) return false;
        //console.log("...required fuel: " + fuel);
        //
        //  toDo: export to own function or merge with estimateNextFuelConsumption
        let tP = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (tP)
        {
            let nextFuel = 0;
            if (tP.neutronium > -1) // ownPlanet
            {
                nextFuel = this.estimateNextFuelConsumption(tP);
                //console.log("...required fuel at next waypoint: " + nextFuel);
                if (nextFuel > tP.neutronium)
                {
                    fuel += (nextFuel - tP.neutronium);
                }
            } else // unowned planet (currently this means expander)
            {
                nextFuel = fuel*2; // provide basic fuel backup for (empty) return trip from unowned planet..
                //console.log("...basic backup fuel: +" + fuel);
                fuel += nextFuel;
            }
        }
        //
        //
        let diff = fuel - this.ship.neutronium;
        //console.log("...ship has " + this.ship.neutronium + ", need additional " + diff + " = " + fuel);
        if (diff <= 0) return true; // if there is enough, we don't need to load fuel
        // else, try to load
        let loadedFuel = 0;
        if (this.planet && this.isOwnPlanet) // only load if we are in orbit around one of our planets
        {
            //console.log("...planet has " + this.planet.neutronium);
            loadedFuel = this.loadObject("fuel", this.planet, diff); // loading "FUEL" overwrites balance limitation (in contrast to "neutronium"), returns amount on board after loading
            //console.log("...fuel loaded: " + loadedFuel);
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
            if (autopilot.objectInsideEnemyMineField( {x: this.ship.x, y: this.ship.y} ).length > 0 && this.ship.engineid > 4) this.ship.warp = 4;
            // reduce speed to warp 3, if we are currently inside a web minefield
            if (autopilot.objectInsideEnemyWebMineField( {x: this.ship.x, y: this.ship.y} ).length > 0 && this.ship.engineid > 3) this.ship.warp = 3;
            // set warp 1 if we are moving into or inside warp well
            if (this.inWarpWell || this.shipTargetInWarpWell(this.ship)) this.ship.warp = 1;
        }
        // update fuelFactor
        this.curFuelFactor = this.fuelFactor["t" + this.ship.engineid][this.ship.warp];
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
            let coords = this.getRandomWarpWellEntryPosition();
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
        let sx1 = oP.x;
        let sy1 = oP.y;
        let sx2 = tP.x;
        let sy2 = tP.y;
        for (let i = 0; i < autopilot.frnnEnemyMinefields.length; i++)
        {
            let mF = autopilot.frnnEnemyMinefields[i];
            if (this.shipPathIntersectsObject(sx1, sy1, sx2, sy2, mF.x, mF.y, mF.radius))
            {
                //console.log("...path intersects with enemy minefield " + mF.id);
                //return false; // deactivated 22.03.17: does not work as expected!
            }
        }
        return true;
        */
    };
    APS.prototype.getNextTurnPosition = function()
    {
        let turnEndpoints = [];
        let C = this.ship;
        let y = vgap.getPath(C);
        let M = 0;
        let d = C.x;
        let e = C.y;
        let w = "";
        for (let r = 0; r < y.length; r++) {
            if (false && !nu.isTest()) {
                M += Math.ceil((y[r].dist) / D);
                let x = vgap.planetAt(y[r].x2, y[r].y2);
                if (x != null && x.debrisdisk === 0) {
                    if ((y[r].dist % D) < 3) {
                        M--
                    }
                }
            } else {
                let E = 1;
                if (C.hullid >= 200 && C.hullid < 300 && C.neutronium === 2) {
                    E = 1.5
                }
                let D = vgap.getSpeed(C.warp, C.hullid);
                D *= E;
                while ((d !== y[r].x2 || e !== y[r].y2) && M ) {
                    M += 1;
                    if (Math.dist(d, e, y[r].x2, y[r].y2) <= D + 0.5) {
                        d = y[r].x2;
                        e = y[r].y2
                    } else {
                        let h = y[r].x2 - d;
                        let k = y[r].y2 - e;
                        if (Math.abs(h) > Math.abs(k)) {
                            let u = Math.floor((D * h) / Math.sqrt((h * h) + (k * k)) + 0.5);
                            d = d + u;
                            e = e + Math.floor(u * (k / h) + 0.5)
                        } else {
                            let v = Math.floor((D * k) / Math.sqrt((h * h) + (k * k)) + 0.5);
                            e = e + v;
                            d = d + Math.floor(v * (h / k) + 0.5)
                        }
                    }
                    if (C.warp > 1) {
                        let z = vgap.warpWell(d, e);
                        let q = z != null && vgap.isHyping(C) && ((Math.abs(z.x - d) === 3) || (Math.abs(z.y - e) === 3));
                        if (z != null && z.debrisdisk === 0 && !q) {
                            d = z.x;
                            e = z.y;
                            let dist = Math.dist(y[r].x2, y[r].y2, z.x, z.y);
                            if (dist <= 3) {
                                y[r].x2 = z.x;
                                y[r].y2 = z.y
                            }
                        }
                    }
                    turnEndpoints.push({
                        x: d,
                        y: e
                    });
                    if (w === "") {
                        w = "Deep Space";
                        let F = vgap.getTarget(d, e);
                        if (F != null ) {
                            w = F.name.substr(0, 20)
                        } else {
                            if (vgap.warpWell(d, e)) {
                                w = "Warp Well"
                            }
                        }
                        w += " (" + d + ", " + e + ")"
                    }
                }
            }
        }
        if (turnEndpoints.length > 0)
        {
            return turnEndpoints[0];
        } else {
            return false;
        }
    };
    APS.prototype.shipPathIntersectsObject = function(sx1, sy1, sx2, sy2, ox, oy, or)
    {
        let dx = sx2 - sx1;
        let dy = sy2 - sy1;
        let dr = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
        //console.log([sx1, sy1, sx2, sy2, ox, oy, or]);
        //console.log(Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)));
        //console.log(Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)) <= or);
        return (Math.abs((sx2 - sx1) * ox + oy * (sy1 - sy2) + (sx1 - sx2) * sy1 + (sy1 - sy2) * ox) / Math.sqrt(Math.pow((sx2 - sx1),2) + Math.pow((sy2 - sy1),2)) <= or);
    };
    /*
     *  setShipTarget
     *      determines next waypoint and sets waypoint as ship target
     *
     *      called in setMissionDestination (phase 2)
     *      and initializeBoardComputer (setup APS, update configuration, setShipTarget OR set flag to determine potential destination first)
     */
    APS.prototype.setShipTarget = function(dP)
    {
        if (typeof dP === "undefined")
        {
            if (this.secondaryDestination)
            {
                dP = this.secondaryDestination;
            } else
            {
                dP = this.destination;
            }
        }
        if (this.planet && dP.id === this.planet.id) return; // toDo: What to do?
        console.log(dP);
        console.log("...searching waypoints to " + dP.name + " (" + dP.id + ").");
        this.setWaypoints(this.ship, dP);
        let target = this.getNextWaypoint(dP);
        if (target)
        {
            console.log("...fly to " + target.id);
            this.ship.targetx = target.x;
            this.ship.targety = target.y;
            let wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
        }
    };
    /*
     *  WAYPOINTS
     */
    APS.prototype.setWaypoints = function(ship, dP)
    {
        // toDo: warpwell minimum distance used, how to implement heading consideration (warpwell max dist = 3)
        this.functionModule.setPotentialWaypoints(this); // potential waypoints specific for the current function (e.g. own planets in case of collector and distributor)
        let ship2dest = Math.ceil(autopilot.getDistance( {x: ship.x , y: ship.y}, {x: dP.x , y: dP.y} ));
        let waypoints = autopilot.getTargetsInRange(this.potentialWaypoints, dP.x, dP.y, ship2dest); // potential waypoints closer to dP
        waypoints.push({ x: dP.x, y: dP.y });
        //console.log("...raw waypoints:");
        let fWPs = [];
        for (let i = 0; i < waypoints.length; i++) // set/save waypoint information
        {
            let pW = vgap.planetAt(waypoints[i].x, waypoints[i].y);
            if (pW)
            {
                let pWC = autopilot.getColony(pW.id);
                if (pWC.determineSafety())
                {
                    let etaDist = Math.ceil(autopilot.getDistance( {x: pW.x , y: pW.y}, {x: ship.x , y: ship.y} )-2.2); // - warpwell of pW
                    if (this.planet) etaDist -= 2.2; // - warpwell of this.planet
                    if (ship2dest < etaDist || etaDist <= 0) continue; // skip waypoints past dP and this.planet
                    let pW2dPDist = Math.ceil(autopilot.getDistance( {x: pW.x , y: pW.y}, {x: dP.x , y: dP.y} )-4.4); // - warpwell of pW and dP
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
        }
        //console.log(fWPs);
        this.potentialWaypoints = fWPs;
    };
    APS.prototype.getNextWaypoint = function(dP, cP, notDP)
    {
        if (typeof notDP === "undefined") notDP = false;
        if ((typeof cP === "undefined" || cP === null) && this.planet) cP = this.planet;
        if ((typeof cP === "undefined" || cP === null) && !this.planet) cP = this.ship;
        let target = false;

        let closeToEnemy = (this.enemyShips || this.enemyPlanets); // use "safe" planet hopping if we are close to enemy territory
        let relativelySafe = false;
        let urgendWaypoint = this.getUrgentWaypoint(dP, cP);
        console.log("urgendWaypoint:", urgendWaypoint);
        if (urgendWaypoint)
        {
            // check if next turn position is covered by a friendly minefield
            let originalX = this.ship.targetx;
            let originalY = this.ship.targety;
            this.ship.targetx = urgendWaypoint.x;
            this.ship.targety = urgendWaypoint.y;
            let nextTurnPos = this.getNextTurnPosition();
            if (nextTurnPos)
            {
                if (autopilot.objectInsideOwnMineField(nextTurnPos)) // toDo: consider potential sweepers
                {
                    relativelySafe = true;
                }
            }
            this.ship.targetx = originalX;
            this.ship.targety = originalY;
        }
        if (urgendWaypoint && (!closeToEnemy || relativelySafe) && !notDP)
        {
            target = urgendWaypoint;
        } else {
            target = this.getEtaWaypoint(dP, cP, notDP);
        }
        return target;
    };
    APS.prototype.destinationAmongWaypoints = function(dP, pW)
    {
        let destination = dP;
        if (this.secondaryDestination)
        {
            destination = this.secondaryDestination;
        }
        for (let i = 0; i < pW.length; i++)
        {
            if (pW[i].pid === destination.id) return true;
        }
        return false;
    };
    APS.prototype.getWaypointsByUrgency = function(dP, origin)
    {
        if (typeof origin === "undefined") origin = this.ship;
        if (this.potentialWaypoints.length === 0) this.setWaypoints(origin, dP); // ensure potential waypoints have been set
        let waypoints = this.potentialWaypoints;
        //console.log("...waypoints by urgency:");
        let dDist = autopilot.getDistance( {x: origin.x , y: origin.y}, {x: dP.x , y: dP.y} )-2.2;
        if (this.planet) dDist -= 2.2; // warpWell
        let dETA = Math.ceil(dDist / Math.pow(this.ship.engineid, 2));
        //console.log("...direct ETA: " + dETA + " (" + dDist + ")");
        let uWPs = [];
        for (let i = 0; i < waypoints.length; i++)
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
        console.log("APS.getUrgentWaypoint: s%s -> p%s", origin.id, dP.id);
        if (typeof origin === "undefined" || origin === null) origin = this.ship;
        let urgentWaypoints = this.getWaypointsByUrgency(dP, origin);
        if (urgentWaypoints.length < 1) return false;
        let dPC = autopilot.getColony(dP.id);
        let uWP = false;
        //console.log("...urgent waypoint:");
        if (this.destinationAmongWaypoints(dP, urgentWaypoints) && dPC.determineSafety() && this.shipPathIsSave(dP))
        {
            uWP = dP;
        } else if (this.destinationAmongWaypoints(dP, urgentWaypoints))
        {
            //console.log("...planet not safe: " + dPC.isSafe);
            //console.log("...ship path not safe: " + this.shipPathIsSave(dP));
        }
        if (!uWP)
        {
            if (urgentWaypoints.length > 1)
            {
                urgentWaypoints = autopilot.sortCollection(urgentWaypoints, "distance");
            }
            for (let i = 0; i < urgentWaypoints.length; i++)
            {
                let pW = vgap.planetAt(urgentWaypoints[i].x, urgentWaypoints[i].y);
                let pWC = autopilot.getColony(pW.id);
                if (pWC.determineSafety())
                {
                    let inWarpWell = autopilot.positionIsInWarpWellOfPlanet(pW, origin);
                    if (inWarpWell || this.shipPathIsSave(pW))
                    {
                        if (inWarpWell)
                        {
                            console.log("...orbiting waypoint:", pW.id);
                        } else {
                            console.log("...safe waypoint:", pW.id);
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
        let waypoints = this.potentialWaypoints;
        //console.log("...waypoints by ETA:");
        let wpByEta = {};
        let ETAs = [];
        for (let i = 0; i < waypoints.length; i++)
        {
            if (not.indexOf(waypoints[i].pid) > -1) continue;
            let eta = Math.ceil(waypoints[i].ship2wPDist / Math.pow(this.ship.engineid, 2));
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
        for (let j = 0; j < ETAs.length; j++)
        {
            let curETA = ETAs[j];
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
        if (dP)
        if (typeof notDP === "undefined") notDP = false;
        if (typeof origin === "undefined" || origin === null) origin = this.ship;
        let not = []; // planet ids to exclude
        let waypoints = this.getWaypointsByEta(dP, origin, not);
        let target = false;
        //console.log("...ETA waypoint:");
        let dPC = autopilot.getColony(dP.id);
        let minETA = 0;
        for (let j = 1; j < 5; j++)
        {
            if (typeof waypoints[j] !== "undefined")
            {
                console.log("...potential waypoints with ETA " + j);
                //waypoints[j] = this.sortCollection(waypoints[j]);
                console.log(waypoints[j]);
                if (minETA === 0)
                {
                    minETA = j; // clostest waypoints (minimal ETA)
                    if (!notDP && this.destinationAmongWaypoints(dP,waypoints[j]) && dPC.determineSafety() && this.shipPathIsSave(dP))
                    {
                        console.log("...potential waypoints contain destination!");
                        target = dP; break;
                    }
                }
                for (let i = 0; i < waypoints[j].length; i++)
                {
                    let pW = vgap.planetAt(waypoints[j][i].x, waypoints[j][i].y);
                    let pWC = autopilot.getColony(pW.id);
                    if (notDP && pW.id === dP.id) continue;
                    // if ETA is bigger (when using pW as next target) than the ETA from current position to destination (direct route) AND pW is not dP...
                    // if (waypoints[j][i].wpETA >= this.getETA(dP,origin) && pW.id !== dP.id) continue;
                    if (autopilot.positionIsInWarpWellOfPlanet(pW, this.ship) && pWC.determineSafety())
                    {
                        console.log("...return in orbit of " + pW.id);
                        target = pW; break;
                    } else if (pWC.determineSafety() && this.shipPathIsSave(pW))
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
    APS.prototype.thereIsACloserWaypoint = function(cWp)
    {
        console.log("...checking if a closer WP is available.");
        // toDo: this is ineffective... what if the current target is not dP but there is a closer
        this.setWaypoints(this.ship, cWp);
        let nWP = this.getNextWaypoint(cWp, null, true);
        if (nWP && nWP.id !== cWp.id)
        {
            this.ship.targetx = nWP.x;
            this.ship.targety = nWP.y;
            let wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
            return this.checkFuel();
        }
        return false;
    };
    APS.prototype.thereIsACloserPlanetWithEnoughFuel = function() // toDo: !!!
    {
        console.log("...checking if a closer planet with fuel is available.");
        return false;
    };
    /*
     *  GENERAL TOOLS
     */
    APS.prototype.getDistance = function(x, y, exact)
    {
        let s = this.ship;
        return autopilot.getDistance( { x: s.x, y: s.y }, { x: x, y: y }, exact )
    };
    APS.prototype.updateNote = function()
    {
        // toDo: setting "use ship note" for APS mission info
        if (autopilot.settings.useShipNote)
        {
            let note = vgap.getNote(this.ship.id, 2);
            if (this.isAPS)
            {
                let destination = "";
                let idle = "";
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
                let secDest = "";
                if (this.secondaryDestination)
                {
                    secDest = this.secondaryDestination.id;
                }
                let ooiText = autopilot.apsOOItext[this.primaryFunction][this.objectOfInterest];
                let funcText = autopilot.apsOOItext[this.primaryFunction].name;
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
        } else {
            autopilot.clearShipNote(this.ship.id);
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
        let center = {};
        if (this.shipFunction === "col")
        {
            center = { x: this.base.x, y: this.base.y };
        } else
        {
            center = { x: this.ship.x, y: this.ship.y };
        }
        let lStorage = autopilot.loadGameData();
        if (lStorage)
        {
            let frnnPositions = [];
            let pids = [];
            let sids = [];
            for(let i = 0; i < lStorage.length; i++)
            {
                // APS is a collector: get ids of base planets
                if (this.primaryFunction === "col" && lStorage[i].shipFunction === this.primaryFunction)
                {
                    pids.push(lStorage[i].base);
                } else if (lStorage[i].shipFunction === this.primaryFunction) // APS is something else: get ids of ships
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
            return autopilot.getTargetsInRange(frnnPositions, center.x, center.y, range);
        }
    };
    APS.prototype.clusterSortCollection = function(collection, cluster, order, direction)
    {
        // default sorting - from low to high (ascending)
        if (typeof direction === "undefined") direction = "asc";
        // get unique categories
        let categories = [];
        for (let i = 0; i < collection.length; i++)
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
        let newCollection = [];
        // put data in clusters, sort clusters by value and concatenate clusters
        for (let j = 0; j < categories.length; j++)
        {
            let clusterCollection = [];
            for (let k = 0; k < collection.length; k++)
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
    /*
     *  MISSION
     */
    APS.prototype.estimateMissionCargo = function(tP, nD)
    {
        let cargo = 0;
        let tPC = autopilot.getColony(tP.id, true);
        if (this.secondaryDestination && tP.id === this.secondaryDestination.id) {
            cargo = tPC.getAPSCargo(this);
        } else if (this.destination.id === tP.id) {
            cargo = tPC.getNextAPSCargo(this, nD);
        } else {
            // transit planet
        }
        if (cargo > this.hull.cargo) {
            return [ this.hull.cargo ];
        } else if (cargo > 0) {
            return [ cargo ];
        } else {
            return [];
        }
    };
    APS.prototype.evaluateMissionDestinations = function()
    {
        // function module specific filtering of potential destinations
        this.functionModule.evaluateMissionDestinations(this);
        // general filtering of potential destinations (e.g. remove destinations located in problematic zones)
        let self = this;
        let filteredDest = this.potDest.filter(function (c) { // base planet, colonies without mission conflict and safe to approach
            return (!self.getMissionConflict(c.planet)) && c.determineSafety();
        });
        let avoidDest = this.potDest.filter(function (c) {
            return !c.determineSafety();
        });
        console.log("APS.evaluateMissionDestinations: Valid destinations = %s, avoided = %s", filteredDest.length, avoidDest.length);
        if (avoidDest.length > 0)
        {
            if (filteredDest.length > 0)
            {
                console.log("...appending avoided-destinations");
                filteredDest.concat(avoidDest);
            } else
            {
                console.log("...using avoided-destinations only");
                filteredDest = avoidDest;
            }
        }
        this.potDest = filteredDest;
    };
    APS.prototype.setMissionDestination = function()
    {
        if (this.potDest.length > 0) {
            this.evaluateMissionDestinations();
            if (this.potDest.length > 0) {
                console.log("APS.setMissionDestination", this.potDest[0].planet.id);
                //console.log(this.potDest);
                if (this.destination) this.lastDestination = this.destination;
                this.destination = vgap.getPlanet(this.potDest[0].planet.id);
                // if no secondary destination is set OR we are at last destination and a secondary destination is set, check if one is (still) necessary
                if (!this.secondaryDestination) this.functionModule.setSecondaryDestination(this);
                //
                this.setShipTarget();
                this.setWarp();
                this.functionModule.setDemand(this);
            } else {
                // idle
                console.warn("APS.setMissionDestination: Ship idle - no primary destination");
                this.ship.targetx = this.ship.x;
                this.ship.targety = this.ship.y;
                this.isIdle = true;
            }
        } else {
            // idle
            console.warn("APS.setMissionDestination: Ship idle - no primary destination");
            this.ship.targetx = this.ship.x;
            this.ship.targety = this.ship.y;
            this.isIdle = true;
        }
        this.updateStoredData();
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
        if (this.planet && this.isOwnPlanet && this.destination) {
            console.log("APS.confirmMission: handle cargo...");
            this.functionModule.handleCargo(this);
        }
        this.functionModule.confirmMission(this);
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
                        let cP = autopilot.getClosestPlanet({ x: this.ship.x, y: this.ship.y }, 0, true);
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
                        let cC = autopilot.getColony(this.planet.id);
                        if (!cC.determineSafety())
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
            // target not set!
            if (this.planet)
            {
                if (this.destination && this.destination.id !== this.planet.id)
                {
                    console.warn("...no target acquired (idle).");
                    this.isIdle = true;
                    this.idleTurns = vgap.game.turn;
                    if (this.idleReason.indexOf("target") === -1) this.idleReason.push("target");
                    let cC = autopilot.getColony(this.planet.id);
                    if (!cC.determineSafety())
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
                    if (this.primaryFunction === "alc" || this.primaryFunction === "ter" || this.primaryFunction === "hiz")
                    {
                        // mission probably not yet completed
                    } else
                    {
                        this.isIdle = true;
                        this.idleTurns = vgap.game.turn;
                        if (this.idleReason.indexOf("dest") === -1) this.idleReason.push("dest");
                    }
                }
            } else
            {
                this.isIdle = true;
                this.idleTurns = vgap.game.turn;
                if (this.idleReason.indexOf("unknown") === -1) this.idleReason.push("unknown");
            }
        }
        this.updateStoredData();
        this.updateNote();
    };
    APS.prototype.getMissionConflict = function(potPlanet)
    {
        if (potPlanet.id === this.base.id) return false; // exclude base planet from evaluation
        return this.functionModule.hasMissionConflict(this, potPlanet);
    };
    APS.prototype.isValidDestination = function(pid)
    {
        if (pid)
        {
            let destPlanet = vgap.getPlanet(pid);
            if (destPlanet) return (destPlanet.ownerid === vgap.player.id || destPlanet.ownerid === 0);
        }
        return false;
    };
    APS.prototype.setDemand = function (destination) // demand = what we need and don't have aboard
    {
        if (typeof destination === "undefined") destination = this.destination;
        this.demand = []; // reset
        let dC = false;
        if (destination) dC = autopilot.getColony(destination.id);
        if (dC)
        {
            let cD = dC.getAPSDemand(this);
            let self = this;
            cD.forEach(
                function (d, index) {
                    if (self.ship[d.item] < d.value)
                    {
                        self.demand.push( {
                            item: d.item,
                            value: (d.value - self.ship[d.item])
                        } );
                    }
                }
            );
        }
        return this.demand;
    };
    APS.prototype.getNextMissionTarget = function(ctP)
    {
        console.log("APS.getNextMissionTarget:");
        let ctC = autopilot.getColony(ctP.id, true);
        if (this.secondaryDestination && this.secondaryDestination.id === ctP.id)
        {
            this.setDemand();
            if (ctC.getAPSCargo(this) >= this.getCurCapacity() || ctC.satisfiesAPSDemand(this, this.demand))
            {
                console.log("...next target is destination", this.destination);
                return this.destination;
            } else
            {
                // is another secondary destination necessary?
                let nextSecondaryDestination = this.functionModule.getNextSecondaryDestination(this, ctP);
                if (nextSecondaryDestination)
                {
                    console.log("...next target is new secondary destination", nextSecondaryDestination);
                    return nextSecondaryDestination;
                } else
                {
                    console.log("...next target is destination", this.destination);
                    return this.destination;
                }
            }
        } else if (this.destination.id === ctP.id)
        {
            // is another secondary destination necessary?
            let nextSecondaryDestination = this.functionModule.getNextSecondaryDestination(this, ctP);
            if (nextSecondaryDestination)
            {
                console.log("...next target is new secondary destination", nextSecondaryDestination);
                return nextSecondaryDestination;
            } else
            {
                // find new destination
                return this.functionModule.getNextPrimaryDestination(this, ctP);
            }
        } else // transit planet => next waypoint
        {
            return false;
        }
    };
    /*
     *  LOADING, UNLOADING, TRANSFER of object from ship to e.g. planet
     */
    APS.prototype.reduceCargoToProceed = function()
    {
        console.log("...checking if reducing cargo will help.");
        if (this.isOwnPlanet)
        {
            // check how long we have been idle
            let c = autopilot.getColony(this.planet.id);
            let idleTurns = 0;
            let i = 0;
            if (this.idleTurns) idleTurns = vgap.game.turns - this.idleTurns;
            let futRes = c.getFuturePlanetResources();
            if (futRes.neutronium > 10 && idleTurns === 0) return false; // wait at least one turn if there will be more fuel next turn
            // check how much we need to reduce the cargo, so we can continue...
            let curCargo = [this.ship.duranium, this.ship.tritanium, this.ship.molybdenum, this.ship.supplies, this.ship.clans];
            let futCargo = curCargo;
            let fraction = 0.9;
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
                let unloadingSequence = ["duranium", "tritanium", "molybdenum", "supplies", "clans"];
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
    APS.prototype.unloadFuel = function()
    {
        if (this.planet && this.isOwnPlanet)
        {
            let amount = parseInt(this.ship.neutronium);
            if (amount > 1 && this.shipFunction !== "alc") amount -= 1;
            let onShip = this.unloadObject("neutronium", this.planet, amount);
        }
    };
    APS.prototype.unloadCargo = function()
    {
        let unloaded = 0;
        if (this.primaryFunction === "exp")
        {
            this.functionModule.transferCargo(this);
        } else if (this.planet && this.isOwnPlanet)
        {
            let unloadingSequence = ["molybdenum", "duranium", "tritanium", "supplies", "clans", "megacredits"];
            for (let i = 0; i < unloadingSequence.length; i++)
            {
                let cargo = unloadingSequence[i];
                unloaded += this.unloadObject(cargo, this.planet, parseInt(this.ship[cargo]));
            }
        }
        console.log("APS.unloadCargo: " + unloaded);
    };
    APS.prototype.unloadObject = function(object, to, amount)
    {
        let actAmount = amount;
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
        let actAmount = 0;
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
        let c = autopilot.getColony(from.id, true);
        if (c.isOwnPlanet)
        {
            let curCapacity = this.getCurCapacity(object);
            if (curCapacity <= 0) return 0;
            let excess = c.balance[object];
            // FUEL BALANCE EXCEPTIONS
            if (object === "fuel") excess = from.neutronium; // overwrite balance
            if (object === "fuel") object = "neutronium";
            // ALCHEMY BALANCE EXCEPTION
            if (object === "supplies" && this.primaryFunction === "alc") excess = from.supplies; // overwrite balance
            // EXPANDER & BUILDER BALANCE EXCEPTIONS
            if (object === "supplies" && (this.primaryFunction === "exp" || this.primaryFunction === "bld") && c.hasStarbase) excess = from.supplies - parseInt(autopilot.settings.defSupRetention); // overwrite balance
            if (object === "megacredits" && (this.primaryFunction === "exp" || this.primaryFunction === "bld" || this.primaryFunction === "col") && c.hasStarbase) excess = from.megacredits - parseInt(autopilot.settings.defMcsRetention); // overwrite balance
            if (object === "megacredits" && this.primaryFunction === "col") excess = from.megacredits - parseInt(autopilot.settings.defMcsRetention); // overwrite balance
            //
            if (excess <= 0) return 0;
            //
            // check requested amount
            //
            let actAmount = excess; // greedy default
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
            console.log("APS.loadObject: " + actAmount + " " + object + " from planet " + from.id);
            return actAmount;
        }
        return false;
    };
    // local storage
    APS.prototype.updateStoredData = function()
    {
        let destination = false;
        if (this.destination) destination = this.destination.id;
        let sDestination = false;
        if (this.secondaryDestination) sDestination = this.secondaryDestination.id;
        let lDestination = false;
        if (this.lastDestination) lDestination = this.lastDestination.id;
        this.storedData = {
            sid: this.ship.id,
            base: this.base.id,
            destination: destination,
            secondaryDestination: sDestination,
            lastDestination: lDestination,
            shipFunction: this.primaryFunction,
            oShipMission: this.oShipMission,
            ooiPriority: this.objectOfInterest,
            idle: this.isIdle,
            idleReason: this.idleReason,
            idleTurns: this.idleTurns
        };
        autopilot.syncLocalStorage(this.storedData);
    };
/*
 * nuPilot - Alchemy Module
 *
 *
 *
 */
function AlchemyAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
    //this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    // data container
    this.sources = [];
    this.sinks = [];
}
/*
    MANDATORY METHODS - called from APS
 */
AlchemyAPS.prototype.handleCargo = function (aps)
{
    if (aps.planet)
    {
        aps.unloadCargo();
        if (aps.objectOfInterest === "neu")
        {
            aps.unloadFuel();
        }
        let loaded = this.loadCargo(aps);
        console.log("Cargo load summary: " + loaded);
    }
};
AlchemyAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
AlchemyAPS.prototype.setSecondaryDestination = function(aps)
{

};
AlchemyAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
AlchemyAPS.prototype.setPotentialDestinations = function(aps)
{
    if (aps.destination) return;
    console.log("Determine potential destinations...");
    // by planet.id sorted sinks (deficiencies)
    if (this.sinks.length === 0) this.setSinks(aps);
    // by planet.id sorted sources (two piles -high/low value- by distance)
    if (this.sources.length === 0) this.setSources(aps);

    aps.potDest = this.sinks;

    if (aps.potDest.length === 0)
    {
        console.log("...no destinations available!");
    } else
    {
        console.log(aps.potDest);
    }
};
AlchemyAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // aps.potDest = aps.potDest;
};
AlchemyAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    return aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
};
AlchemyAPS.prototype.confirmMission = function (aps)
{
    console.log("Setting ship " + aps.ship.id + " FC!");
    if (aps.objectOfInterest === "all")
    {
        aps.ship.friendlycode = "abc"; // toDo: random FC
    } else if (aps.objectOfInterest === "dur")
    {
        aps.ship.friendlycode = "ald";
    } else if (aps.objectOfInterest === "tri")
    {
        aps.ship.friendlycode = "alt";
    } else if (aps.objectOfInterest === "mol")
    {
        aps.ship.friendlycode = "alm";
    }
};
AlchemyAPS.prototype.postActivationHook = function (aps)
{

};
AlchemyAPS.prototype.missionCompleted = function(aps)
{
    // alchemist is fixed to current planet
    // Thus, mission is never completed, unless deactivated
    return false;
};
AlchemyAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    return false;
};
AlchemyAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    return false;
};
/*
    INTERNAL METHODS
 */
AlchemyAPS.prototype.setSinks = function(aps)
{
    // as alchemist, current planet is a sink
    this.sinks = [ autopilot.getColony(aps.planet.id) ];
};
AlchemyAPS.prototype.setSources = function(aps)
{
    // as alchemist, current planet is a source
    this.sources = [ autopilot.getColony(aps.planet.id) ];
};
AlchemyAPS.prototype.isSource = function(aps)
{
    let c = autopilot.getColony(aps.planet.id, true);
    if (aps.objectOfInterest === "neu") return (c.balance.supplies > 0 && (c.balance.duranium > 0 || c.balance.tritanium > 0 || c.balance.molybdenum > 0));
    return (c.balance.supplies > 0);
};
AlchemyAPS.prototype.loadCargo = function(aps)
{
    let loaded = 0;
    if (aps.objectOfInterest === "neu")
    {
        let c = autopilot.getColony(aps.planet.id, true);
        let bc = [
            {
                mineral: "tritanium",
                value: c.balance.tritanium
            },
            {
                mineral: "duranium",
                value: c.balance.duranium
            },
            {
                mineral: "molybdenum",
                value: c.balance.molybdenum
            }
        ];
        bc = autopilot.sortCollection(bc, "value", "desc");
        let halfCap = Math.floor(aps.hull.cargo * 0.5);
        if (c.planet.supplies >= halfCap)
        {
            if (bc[0].value >= halfCap)
            {
                loaded += aps.loadObject(bc[0].mineral, aps.planet, halfCap);
                loaded += aps.loadObject("supplies", aps.planet, halfCap);
            } else
            {
                loaded += aps.loadObject(bc[0].mineral, aps.planet, bc[0].value);
                loaded += aps.loadObject("supplies", aps.planet, bc[0].value);
            }
        } else
        {
            if (bc[0].value >= c.planet.supplies)
            {
                loaded += aps.loadObject(bc[0].mineral, aps.planet, c.planet.supplies);
                loaded += aps.loadObject("supplies", aps.planet, c.planet.supplies);
            } else
            {
                loaded += aps.loadObject(bc[0].mineral, aps.planet, bc[0].value);
                loaded += aps.loadObject("supplies", aps.planet, bc[0].value);
            }
        }
    } else
    {
        loaded += aps.loadObject("supplies");
    }
    return loaded;
};/*
 *  nuPilot - Distributor Module
 *
 *
 *
 */
function BuilderAPS()
{
    this.minimalCargoRatioToGo = parseFloat(autopilot.settings.disMinCapacity); // percent of cargo capacity (e.g. 0.7 = 70%)
    this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
    this.scopeRange = autopilot.settings.disScopeRange;
    //this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
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
BuilderAPS.prototype.handleCargo = function (aps) // called once on initialization and a second time with aps.confirmMission
{
    if (aps.planet && aps.isOwnPlanet)
    {
        this.setDemand(aps);
        if (aps.destination.id === aps.planet.id) // unload cargo when at destination
        {
            aps.unloadCargo();
            aps.unloadFuel();
            this.setDemand(aps);
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id)
        {
            // we are at secondary destination
            if (aps.demand.length > 0) {
                let secDestCol = autopilot.getColony(aps.planet.id, true);
                if (this.colonyIsSource(aps, secDestCol)) {
                    this.loadCargo(aps); // load cargo
                }
            } else {
                aps.secondaryDestination = false; // no demand left, set secondary destination to false, so we can continue to destination
                if (aps.getCargoCapacity() === aps.hull.cargo) aps.destination = aps.planet; // if we don't have any cargo, set destination to current planet, since destination doesn't need anything
            }
        } else // transit planets
        {
            if (!aps.secondaryDestination) { // we are on our way to the destination
                // in case demand has changed in the meantime, unload and try to load cargo
                if (aps.demand.length > 0 && aps.getCurCapacity() > 0) {
                    console.log(aps.demand);
                    aps.unloadCargo();
                    let transitCol = autopilot.getColony(aps.planet.id, true);
                    if (this.colonyIsSource(aps, transitCol)) {
                        this.loadCargo(aps); // load cargo
                    } else {
                        // if we can't load here, we need a secondary destination
                        this.setSecondaryDestination(aps);
                    }
                }
                aps.unloadCargo();
                let dC = autopilot.getColony(aps.destination.id, true);
                if (dC.getAPSDemand(aps).length === 0) // if there is no more demand at destination
                {
                    aps.lastDestination = aps.destination;
                    aps.destination = aps.planet;
                } else
                {
                    let transitCol = autopilot.getColony(aps.planet.id, true);
                    if (this.colonyIsSource(aps, transitCol)) {
                        this.loadCargo(aps); // load cargo
                    }
                }
            }
        }
        this.setDemand(aps);
        //console.log("Cargo summary: " + transCargo);
    }
};
BuilderAPS.prototype.setDemand = function (aps, destination) // demand = what we need and don't have aboard
{
    if (typeof destination === "undefined") destination = aps.destination;
    aps.demand = []; // reset
    let dC = autopilot.getColony(destination.id, true);
    if (dC)
    {
        let cD = dC.getAPSDemand(aps);
        //console.log(cD);
        cD.forEach(
            function (d, index) {
                if (aps.ship[d.item] < d.value)
                {
                    aps.demand.push( {
                        item: d.item,
                        value: (d.value - aps.ship[d.item])
                    } );
                }
            }
        );
    }
    return aps.demand;
};
BuilderAPS.prototype.setPotentialDestinations = function(aps)
{
    if (aps.potDest.length === 0) {
        aps.potDest = this.getConstructionSites(aps);
        if (aps.potDest < 1) {
            console.warn("No construction sites available!");
            aps.isIdle = true;
        } else {
            aps.isIdle = false;
        }
        aps.updateStoredData();
    }
};
BuilderAPS.prototype.setSecondaryDestination = function(aps)
{
    console.info("BuilderAPS.setSecondaryDestination:");

    // do we (still) need a secondary destination?
    if (aps.planet && aps.planet.id !== aps.destination.id)
    {
        this.loadCargo(aps); // make sure we took all we can get from current planet. (updates demand of destination)
    } else
    {
        this.setDemand(aps);
    }
    if (aps.getCargoCapacity() === 0 || aps.demand.length === 0) {
        if (aps.getCargoCapacity() === 0) console.log("BuilderAPS.setSecondaryDestination:...we are full, no need for a secondary destination at the moment.");
        if (aps.demand.length === 0) console.log("BuilderAPS.setSecondaryDestination:...destination has no demand left, no need for a secondary destination (%s).", aps.secondaryDestination);
        if (aps.secondaryDestination) aps.secondaryDestination = false;
        return;
    }
    // there is unsatisfied demand!
    console.log("BuilderAPS.setSecondaryDestination:...destination still has demands >>");
    console.log(aps.demand);
    //
    let dC = autopilot.getColony(aps.destination.id, true);
    let potSource = this.pickSource(aps, dC);
    if (potSource)
    {
        if (potSource.distance2APS > dC.distance2APS && aps.getCurCapacity() <= aps.minCapacity)
        {
            console.log("...we are closer to destination and have minCapacity on board, proceed to destination!");
        } else {
            console.log("BuilderAPS.setSecondaryDestination:...set secondary destination:", potSource.planet.id);
            aps.secondaryDestination = potSource.planet;
        }
    } else {
        // no secondary destination (sufficient source) found
        console.warn("BuilderAPS.setSecondaryDestination:...couldn't find an adequate source!");
        aps.idle = true;
        if (aps.idleReason.indexOf("Source N/A") === -1) aps.idleReason.push("Source N/A");
    }
};
BuilderAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
BuilderAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // no module specific filtering
};
BuilderAPS.prototype.hasMissionConflict = function(aps, potPlanet, secondary)
{
    /* Deactivated since demand and deliveries of all APS are considered during destination determination!
    if (typeof secondary === "undefined") secondary = false;
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id, aps.primaryFunction, aps.objectOfInterest, secondary); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS && conflictAPS.length > 2 && !secondary)
    {
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        return true;
    } */
    return false;
};
BuilderAPS.prototype.confirmMission = function (aps)
{
    if (aps.planet && aps.destination.id === aps.planet.id && !aps.secondaryDestination)
    {
        console.warn("BuilderAPS.confirmMission: WE ARE AT DESTINATION PLANET WITHOUT SECONDARY DESTINATION SET...!");
    }
    if (!aps.targetIsSet())
    {
        aps.setMissionDestination();
        aps.initAPScontrol();
    }
    // toDo: if a secondary destination is set, check if this is still the best choice
};
BuilderAPS.prototype.postActivationHook = function (aps)
{
    if (aps.objectOfInterest === "fib") aps.ship.friendlycode = "lfm";
};
BuilderAPS.prototype.missionCompleted = function(aps)
{
    let cC = autopilot.getColony(aps.destination.id, true);
    let demand = cC.getAPSDemand(aps);
    if (demand.length === 0) return true;
    let demandCargo = demand.reduce(function (total, d) {
        if (d.item === "megacredits") return total;
        return total + d.value;
    });
    return (demandCargo < aps.minCapacity);
};
BuilderAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    let ctC = autopilot.getColony(ctP.id, true);
    let nextDemands = ctC.getNextAPSDemand(aps, aps.demand);
    if (nextDemands.length === 0)
    {
        return false;
    } else
    {
        let dC = autopilot.getColony(aps.destination.id, true);
        let source = this.pickSource(aps, dC, ctP, nextDemands);
        if (source)
        {
            console.log("...next secondary destination:", source.planet.id);
            return source.planet;
        } else {
            // return base planet if no secondary destination could be found
            console.log("...next secondary destination: base => ", aps.base.id);
            return aps.base;
        }
    }
};
BuilderAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    let cSites = this.getConstructionSites(aps);
    if (cSites.length > 0)
    {
        console.log("...next target is new destination", cSites[0].planet);
        return cSites[0].planet;
    } else
    {
        console.log("...next target is BASE", aps.base);
        return aps.base;
    }
};
/*
    INTERNAL METHODS
 */
BuilderAPS.prototype.colonyIsSource = function(aps, colony)
{
    let isSource = false;
    if (aps.objectOfInterest === "shb" && (colony.hasStarbase || colony.isBuildingBase) && !colony.isFort) return false; // ship builders don't use other ship building starbases as source
    this.setDemand(aps);
    aps.demand.forEach(
        function (demand, index) {
            if (colony.balance[demand.item] > 0) isSource = true;
        }
    );
    return isSource;
};
BuilderAPS.prototype.loadCargo = function(aps) // never called when destination = planet
{
    this.setDemand(aps);
    if (aps.demand.length > 0)
    {
        // transform aps.demand into [ { demand.item: demand.value } ]
        let demands = {
            duranium: 0,
            tritanium: 0,
            molybdenum: 0,
            clans: 0,
            supplies: 0,
            megacredits: 0
        };
        aps.demand.forEach(
            function (demand, index) {
                demands[demand.item] = demand.value;
            }
        );
        aps.demand.sort(function (a, b) {
            return b.value - a.value;
        });
        console.log("BuilderAPS.loadCargo: Current demands", aps.demand);
        // check if megecredits are demanded
        if (demands.megacredits > 0)
        {
            console.log("Demand megacredits = %s", demands.megacredits);
            // check if enough is available
            let c = autopilot.getColony(aps.planet.id, true);
            let retainMcs = parseInt(autopilot.settings.defMcsRetention);
            if (c.planet.megacredits < demands.megacredits + retainMcs) // if not enough MCs are available
            {
                let neededMCs = (demands.megacredits + retainMcs) - c.planet.megacredits;
                console.log("...need %d additional megacredits!", neededMCs);
                // check if supplies can be sold
                console.log("Demand supplies = %s", demands.supplies);
                let retainSupply = parseInt(autopilot.settings.defSupRetention);
                let toBeSold = 0;
                if (demands.supplies < c.planet.supplies - retainSupply) // there are more supplies than needed
                {
                    let maxAvailableSup = c.planet.supplies - retainSupply;
                    if (maxAvailableSup >= neededMCs) {
                        toBeSold = neededMCs;
                    } else {
                        toBeSold = maxAvailableSup;
                    }
                } else // there are not enough supplies
                {
                    toBeSold = c.planet.supplies - retainSupply; // max available
                }
                console.log("We could sell %s supplies.", toBeSold);
                if (toBeSold > 0) c.sellSupply(true, false, toBeSold);
            }
        }
        let loaded = 0;
        aps.demand.forEach(
            function (demand, index) {
                loaded += aps.loadObject(demand.item, aps.planet, demand.value);
            }
        );
        console.log("APS %s with minCapacity of %s has current capacity %s", aps.ship.id, aps.minCapacity, aps.getCurCapacity());
        if (aps.objectOfInterest === "stb" && aps.getCurCapacity() > aps.minCapacity && (demands.supplies > 0 || demands.clans > 0)) // try to load to minCapacity
        {
            let furtherLoad = true;
            while (aps.getCurCapacity() >= aps.minCapacity && furtherLoad)
            {
                let seqLoad = false;
                this.priorities.stb.forEach(
                    function (item, index) {
                        let obj = aps.moveables[item];
                        if (obj === "megacredits") return;
                        let value = demands[obj];
                        if (value > 0 && aps.loadObject(obj, aps.planet, value)) seqLoad = true;
                    }
                );
                if (!seqLoad) furtherLoad = false;
            }
        }
        this.setDemand(aps);
        return loaded;
    } else
    {
        return 0;
    }
};
BuilderAPS.prototype.setScopeRange = function(aps)
{
    if (this.scopeRange === "auto")
    {
        let inRange = aps.getAPSinRange(aps.simpleRange);
        if (inRange && inRange.length > 4)
        {
            aps.scopeRange = aps.simpleRange * 4;
        } else
        {
            aps.scopeRange = aps.simpleRange * 2;
        }
    } else
    {
        aps.scopeRange = parseInt(this.scopeRange);
    }
};
BuilderAPS.prototype.getBasesToConstruct = function(aps)
{
    let potSites = [];
    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id, true);
        if (c.isBuildingBase || (c. hasStarbase && c.isFort))
        {
            let demand = c.getAPSDemand(aps);
            if (demand.length > 0)
            {
                c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
                potSites.push(c);
            }
        }
    }
    return potSites;
};
BuilderAPS.prototype.getPlanetsToDevelop = function(aps)
{
    let potSites = [];
    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id, true);
        if (c.isBuildingStructures)
        {
            if (c.getAPSDemand(aps).length > 0)
            {
                //console.log("...development site with demand:", c.planet.id, c, c.getAPSDemand(aps));
                c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
                potSites.push(c);
            }
        }
    }
    if (potSites.length > 1)
    {
        let inScope = potSites.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        let outScope = potSites.filter(function (c) {
            return c.distance2APS > aps.scopeRange;
        });
        if (inScope.length === 0 && outScope.length > 0)
        {
            potSites = outScope;
            potSites.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
        } else if (inScope.length > 0)
        {
            inScope.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
            if (outScope.length > 0)
            {
                outScope.sort(function (a, b) {
                    return a.distance2APS - b.distance2APS;
                });
                // add construction site outside the scope range to the end
                inScope.push(outScope.shift());
                while (inScope.length < 5 && outScope.length > 0)
                {
                    inScope.push(outScope.shift()); // add other construction site outside the scope range if inScope contains less than 5 targets
                }
            }
            potSites = inScope;
        }
    }
    console.warn("Potential construction sites >>");
    console.log(potSites);
    return potSites;
};
BuilderAPS.prototype.getFillWithFighterCosts = function(aps, capacity, pThresh, turns)
{
    if (typeof capacity === "undefined") capacity = aps.getCurCapacity();
    if (typeof turns === "undefined") turns = 99;
    if (typeof pThresh === "undefined") pThresh = 0;
    let potentialFighters = Math.floor(capacity / 10);
    let costs = {
        tritanium: 0,
        molybdenum: 0,
        supplies: 0,
        turns: 0
    };
    while (capacity >= 10 && costs.turns < turns && potentialFighters > pThresh)
    {
        capacity -= potentialFighters;
        costs.tritanium += potentialFighters * 3;
        costs.molybdenum += potentialFighters * 2;
        costs.supplies += potentialFighters * 5;
        costs.turns++;
        potentialFighters = Math.floor(capacity / 10);
    }
    return costs;
};
BuilderAPS.prototype.getProductionSites = function(aps)
{
    console.log("BuilderAPS.getProductionSites:");
    let potSites = [];
    let resources = ["tritanium", "molybdenum", "supplies"];
    let oneTurnProductionCosts = this.getFillWithFighterCosts(aps, aps.getCurCapacity(), 0, 1);

    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id);
        let ready4production = true;
        resources.forEach(function (r) {
            if (c.planet[r] < oneTurnProductionCosts[r]) ready4production = false;
        });

        if (ready4production)
        {
            c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
            potSites.push(c);
        }
    }
    return potSites;
};
BuilderAPS.prototype.getPlanetsWithStarbase = function(aps)
{
    console.log("BuilderAPS.getPlanetsWithStarbase:");
    let potSites = [];
    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id, true);
        if (c.hasStarbase && !c.isFort)
        {
            let demand = c.getAPSDemand(aps);
            if (demand.length > 0)
            {
                c.distance2APS = aps.getDistance(c.planet.x, c.planet.y);
                potSites.push(c);
            }
        }
    }
    console.log("...potential starbases:", potSites);
    return potSites;
};
BuilderAPS.prototype.getSources = function(aps, site)
{
    console.log("BuilderAPS.getSources: for site", site);
    // get sources
    // (a) between here and there (closer or same turn distance)
    // OR
    // (b) within scopeRange of the site
    //
    let potColonies = [];
    let here2siteTurnDist = Math.ceil(aps.getDistance(site.planet.x, site.planet.y, false) / aps.simpleRange);
    //
    //console.log("Distance (turns) to site (%s): %s", site.planet.id, here2siteTurnDist);
    //
    if (aps.planet && aps.planet.id === site.planet.id || here2siteTurnDist <= 2) // if we are at site => (b)
    {
        this.setScopeRange(aps);
        let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
        //
        targetsInRange = targetsInRange.filter(function (t) {
            return t.id !== site.planet.id;
        });
        console.log("...found %s potential sources within %s lys.", targetsInRange.length, aps.scopeRange);
        console.log(targetsInRange);
        //
        if (targetsInRange.length > 0)
        {
            let self = this;
            targetsInRange.forEach(
                function (t, index) {
                    let curC = autopilot.getColony(t.id, true);
                    curC.distance2APS = aps.getDistance(t.x, t.y);
                    curC.distance2Site = autopilot.getDistance(curC.planet, site.planet);
                    curC.builderCargo = curC.getAPSCargo(aps);
                    //console.log("Planet %s is builderSource: %s", t.id, curC.isBuilderSource(aps));
                    if (self.colonyIsSource(aps, curC) && curC.determineSafety()) potColonies.push( curC );
                }
            );
        }
    } else // if we are somewhere else => (a)
    {
        let self = this;
        vgap.myplanets.forEach(
            function (p, index) {
                if ((aps.planet && p.id === aps.planet.id) || p.id === site.planet.id) return; // skip current and destination planet
                let src2siteTurnDist = Math.ceil(autopilot.getDistance( { x: p.x, y: p.y }, { x: site.planet.x, y: site.planet.y }, false ) / aps.simpleRange);
                //console.log("Turn distance from source %s to site: %s", p.id, src2siteTurnDist);
                let curC = autopilot.getColony(p.id, true);
                curC.distance2APS = aps.getDistance(curC.planet.x, curC.planet.y);
                curC.distance2Site = autopilot.getDistance(curC.planet, site.planet);
                curC.builderCargo = curC.getAPSCargo(aps);
                //console.log(curC);
                if (src2siteTurnDist <= here2siteTurnDist + 1 && self.colonyIsSource(aps, curC) && curC.determineSafety()) potColonies.push( curC );
            }
        );
    }
    console.log("...potColonies:", potColonies);
    return potColonies;
};
BuilderAPS.prototype.getClassifiedSources = function(aps, site, sources, demands)
{
    console.log("BuilderAPS.getClassifiedSources:", site);
    if (typeof demands === "undefined") demands = site.getAPSDemand(aps);
    console.log("...builderDemands:", demands);
    demands.sort(function(a, b) {
        if (b.item === "megacredits") return -1;
        return b.value - a.value;
    });
    console.log("...demands", demands);
    let satisfyingMostLacking = sources.filter(function (c) {
        let relevantCapacity = aps.getCurCapacity(demands[0].item);
        if (demands[0].item !== "megacredits" && aps.getCurCapacity() === aps.hull.cargo) relevantCapacity = aps.minCapacity;
        if (demands[0].item === "megacredits" && aps.getCurCapacity("megacredits") === 10000) relevantCapacity = 5000;
        return (c.balance[demands[0].item] >= demands[0].value || c.balance[demands[0].item] >= relevantCapacity);
    });
    satisfyingMostLacking.sort(function (a, b) {
        return a.distance2Site - b.distance2Site;
    });
    console.log("...satisfyingMostLacking:", satisfyingMostLacking);
    let satisfyingAll = sources.filter(function (c) {
        let satisfying = true;
        demands.forEach(function (d) {
            if (c.balance[d.item] < d.value && c.balance[d.item] < aps.getCurCapacity(d.item)) satisfying = false;
        });
        return satisfying;
    });
    satisfyingAll.sort(function (a, b) {
        return a.distance2Site - b.distance2Site;
    });
    console.log("...satisfyingAll:", satisfyingAll);
    let satisfyingSome = sources.filter(function (c) {
        let satisfying = false;
        demands.forEach(function (d) {
            if (c.balance[d.item] >= d.value || c.balance[d.item] >= aps.getCurCapacity(d.item)) satisfying = true;
        });
        return satisfying;
    });
    satisfyingSome.sort(function (a, b) {
        return a.distance2Site - b.distance2Site;
    });
    console.log("...satisfyingSome:", satisfyingSome);
    let offeringMinCapacity = sources.filter(function (c) {
        let cargo = 0;
        let mcs = 0;
        demands.forEach(function (d) {
            if (d.item !== "megacredits")
            {
                if (c.balance[d.item] > 0)
                {
                    if (d.value >= c.balance[d.item])
                    {
                        cargo += c.balance[d.item];
                    } else
                    {
                        cargo += d.value;
                    }
                }
            }
            if (d.item === "megacredits") mcs += c.balance[d.item];
        });
        //console.log("...cargo %d >= minCap %d", cargo, aps.minCapacity);
        return cargo >= aps.minCapacity || mcs >= 5000;
    });
    offeringMinCapacity.sort(function (a, b) {
        return a.distance2Site - b.distance2Site;
    });
    console.log("...offeringMinCapacity:", offeringMinCapacity);

    return [].concat(satisfyingMostLacking, satisfyingAll, offeringMinCapacity, satisfyingSome);
};
BuilderAPS.prototype.pickSource = function(aps, site, excludePlanet, demands)
{
    console.log("BuilderAPS.pickSource:");
    if (typeof excludePlanet === "undefined") excludePlanet = false;
    if (typeof demands === "undefined") demands = site.getAPSDemand(aps);
    let source = false;
    let potColonies = this.getSources(aps, site);
    if (potColonies.length > 0)
    {
        if (potColonies.length > 1)
        {
            let finalSourceCollection = this.getClassifiedSources(aps, site, potColonies, demands);
            console.log("...finalSourceCollection:", finalSourceCollection);

            for (let i = 0; i < finalSourceCollection.length; i++)
            {
                if (this.hasMissionConflict(aps, finalSourceCollection[i].planet, true)) continue;
                if (excludePlanet && excludePlanet.id === finalSourceCollection[i].planet.id) continue;
                return finalSourceCollection[i];
            }
        }
        potColonies.sort(function (a, b) {
            return a.distance2APS - b.distance2APS;
        });
        if (excludePlanet && excludePlanet.id === potColonies[0].planet.id) return false;
        if (!this.hasMissionConflict(aps, potColonies[0].planet, true)) return potColonies[0];
    }
    return source;
};
BuilderAPS.prototype.classifyDevelopmentSites = function(sites)
{
    console.log("BuilderAPS.classifyDevelopmentSites:");
    // classify according to resources
    let resRichSites = sites.filter(function (c) {
        return c.k75Minerals.length > 0;
    });
    let resModerateSites = sites.filter(function (c) {
        return c.k50Minerals.length > 0;
    });
    let resLessSites = sites.filter(function (c) {
        return c.k75Minerals.length === 0 && c.k50Minerals.length === 0;
    });
    let priorizedSites = [].concat(resRichSites, resModerateSites, resLessSites);
    console.log("...prioritized construction sites:", priorizedSites);
    let potentialSites = [];
    let allIds = [];
    priorizedSites.forEach(function (c) {
        if (allIds.indexOf(c.planet.id) === -1) potentialSites.push(c);
        allIds.push(c.planet.id);
    });
    return potentialSites;
};
BuilderAPS.prototype.classifyBases = function(sites, aps)
{
    console.log("BuilderAPS.classifyBases:");
    let priorizedSites = [];
    if (sites.length > 0)
    {
        let inScope = sites.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        let outScope = sites.filter(function (c) {
            return c.distance2APS > aps.scopeRange;
        });
        if (inScope.length === 0 && outScope.length > 0)
        {
            sites = outScope;
            sites.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
        } else if (inScope.length > 0)
        {
            inScope.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
            if (outScope.length > 0)
            {
                outScope.sort(function (a, b) {
                    return a.distance2APS - b.distance2APS;
                });
                // add construction site outside the scope range to the end
                inScope.push(outScope.shift());
                while (inScope.length < 5 && outScope.length > 0)
                {
                    inScope.push(outScope.shift()); // add other construction site outside the scope range if inScope contains less than 5 targets
                }
            }
            sites = inScope;
        }
        console.log("...potential starbase planets", sites);
        // classify according to resources within range
        let richSites = sites.filter(function (c) {
            let durInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "duranium");
            let durRatio = durInRange / autopilot.globalMinerals.duranium;
            let triInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "tritanium");
            let triRatio = triInRange / autopilot.globalMinerals.tritanium;
            let molInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "molybdenum");
            let molRatio = molInRange / autopilot.globalMinerals.molybdenum;
            return (durRatio >= 0.25 && triRatio >= 0.25 && molRatio >= 0.25);
        });
        console.log("richSites", richSites);
        let moderateSites = sites.filter(function (c) {
            let durInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "duranium");
            let durRatio = durInRange / autopilot.globalMinerals.duranium;
            let triInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "tritanium");
            let triRatio = triInRange / autopilot.globalMinerals.tritanium;
            let molInRange = autopilot.getSumOfAvailableObjectInRange(c.planet, aps.scopeRange, "molybdenum");
            let molRatio = molInRange / autopilot.globalMinerals.molybdenum;
            return ((durRatio >= 0.1 && durRatio < 0.25) && (triRatio >= 0.1 && triRatio < 0.25) && (molRatio >= 0.1 && molRatio < 0.25));
        });
        console.log("moderateSites", moderateSites);
        //
        let richAndModerateIds = [].concat(richSites.map(function (c) {
            return c.planet.id;
        }),moderateSites.map(function (c) {
            return c.planet.id;
        }));
        let poorSites = sites.filter(function (c) {
            return richAndModerateIds.indexOf(c.planet.id) === -1;
        });
        console.log("poorSites", poorSites);
        priorizedSites = [].concat(richSites, moderateSites, poorSites);
    }
    console.warn("...prioritized starbase planets", priorizedSites);
    return priorizedSites;
};
BuilderAPS.prototype.classifyProductionSites = function(sites, aps)
{
    console.log("BuilderAPS.classifyProductionSites:");
    let priorizedSites = [];
    if (sites.length > 0)
    {
        let inScope = sites.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        let outScope = sites.filter(function (c) {
            return c.distance2APS > aps.scopeRange;
        });
        if (inScope.length === 0 && outScope.length > 0)
        {
            sites = outScope;
            sites.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
        } else if (inScope.length > 0)
        {
            inScope.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
            if (outScope.length > 0)
            {
                outScope.sort(function (a, b) {
                    return a.distance2APS - b.distance2APS;
                });
                // add construction site outside the scope range to the end
                inScope.push(outScope.shift());
                while (inScope.length < 5 && outScope.length > 0)
                {
                    inScope.push(outScope.shift()); // add other construction site outside the scope range if inScope contains less than 5 targets
                }
            }
            sites = inScope;
        }
        console.log("...potential production sites", sites);
        // classify according to production potential
        let fillCosts = this.getFillWithFighterCosts(aps, aps.getCurCapacity());
        let resources = ["tritanium", "molybdenum", "supplies"];
        let richSites = sites.filter(function (c) {
            let ready4fullProduction = true;
            resources.forEach(function (r) {
                if (r !== "supplies" && c.planet[r] + (c.mineralProduction[r] * fillCosts.turns) < fillCosts[r]) ready4fullProduction = false;
                if (r === "supplies" && c.planet[r] + (c.planet.factories * fillCosts.turns) < fillCosts[r]) ready4fullProduction = false;
            });
            return ready4fullProduction;
        });
        console.log("richSites", richSites);
        let richSitesIds = [];
        if (richSites.length > 0)
        {
            richSitesIds = richSites.map(function (c) {
                return c.planet.id;
            });
        }

        let richTransferSites = richSites.filter(function (c) {
            let ships = vgap.shipsAt(c.planet.x, c.planet.y);
            let carrierCapacity = 0;
            if (ships)
            {
                ships.forEach(function (s) {
                    let cH = vgap.getHull(s.hullid);
                    if (s.ownerid === vgap.player.id && s.bays > 0 && s.ammo < cH.cargo) carrierCapacity += cH.cargo - s.ammo;
                });
            }
            return (c.hasStarbase && c.hasStarbase.fighters < 60) || carrierCapacity > 0;
        });
        console.log("richTransferSites", richTransferSites);

        if (richTransferSites.length > 0)
        {
            let rTSids = richTransferSites.map(function (c) {
                return c.planet.id;
            });
            richSites = richSites.filter(function (c) {
                return rTSids.indexOf(c.planet.id) === -1;
            });
        }

        let threeTurnCosts = this.getFillWithFighterCosts(aps, aps.getCurCapacity(), 0, 3);
        let moderateSites = sites.filter(function (c) {
            let ready4moderateProduction = true;
            resources.forEach(function (r) {
                if (r !== "supplies" && c.planet[r] + (c.mineralProduction[r] * threeTurnCosts.turns) < threeTurnCosts[r]) ready4moderateProduction = false;
                if (r === "supplies" && c.planet[r] + (c.planet.factories * threeTurnCosts.turns) < threeTurnCosts[r]) ready4moderateProduction = false;
            });
            return ready4moderateProduction;
        });
        console.log("moderateSites", moderateSites);
        let moderateSitesIds = [];
        if (richSites.length > 0)
        {
            moderateSitesIds = moderateSites.map(function (c) {
                return c.planet.id;
            });
        }
        //
        let richAndModerateIds = [].concat(richSitesIds, moderateSitesIds);
        let poorSites = sites.filter(function (c) {
            return richAndModerateIds.indexOf(c.planet.id) === -1;
        });
        console.log("poorSites", poorSites);
        priorizedSites = [].concat(richTransferSites, richSites, moderateSites, poorSites);
    }
    console.warn("...prioritized production sites", priorizedSites);
    return priorizedSites;
};
BuilderAPS.prototype.getConstructionSites = function(aps)
{
    console.log("BuilderAPS.getConstructionSites:");
    this.setScopeRange(aps);
    let sites = [];
    if (aps.objectOfInterest === "bab")
    {
        sites = this.classifyBases(this.getBasesToConstruct(aps), aps);
        console.log(sites);
        if (sites.length > 1)
        {
            sites.sort(function(a, b){
                return a.distance2APS - b.distance2APS;
            });
        }
    } else if (aps.objectOfInterest === "stb")
    {
        sites = this.classifyDevelopmentSites(this.getPlanetsToDevelop(aps));
    } else if (aps.objectOfInterest === "fib")
    {
        sites = this.classifyProductionSites(this.getProductionSites(aps), aps);
    } else if (aps.objectOfInterest === "shb")
    {
        if (aps.planet)
        {
            let c = autopilot.getColony(aps.planet.id, true);
            if ((c.isBuildingBase || c.hasStarbase) && !c.isFort && c.getAPSDemand(aps).length > 0) // if APS is at a starbase that has demand, bind APS to it
            {
                sites = [c];
            }
        }
        if (sites.length === 0)
        {
            sites = this.classifyBases(this.getPlanetsWithStarbase(aps), aps);
        }
    }
    console.log("...construction sites:", sites);
    return sites;
};
/*
 * nuPilot - Collector Module
 *
 *      https://github.com/drgirasol/nupilot/wiki/Collector
 *
 */
function CollectorAPS()
{
    this.minimalCargoRatioToGo = parseFloat(autopilot.settings.colMinCapacity); // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.scopeRange = autopilot.settings.colScopeRange;
    //this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.alwaysLoadMC = true; // freighter missions will always include MCs
    this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
    // data container
    this.sources = [];
    this.sinks = [];
}
/*
    GENERAL REQUIRED METHODS
 */
CollectorAPS.prototype.handleCargo = function(aps)  // called once on initialization and a second time with aps.confirmMission
{
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.atBase) // we are at base (sink)
        {
            if (!aps.isMakingTorpedoes()) aps.unloadCargo();
            if (aps.objectOfInterest === "neu") aps.unloadFuel();
        } else // source or waypoint
        {
            if (!aps.isMakingTorpedoes()) aps.unloadCargo(); // unload prior to loading
            let transCargo = this.loadCargo(aps);
            console.log("Cargo load summary: " + transCargo);
        }
    }
};
CollectorAPS.prototype.setDemand = function (aps) // demand = what we need and don't have aboard
{
    aps.demand = []; // reset
};
CollectorAPS.prototype.setPotentialDestinations = function(aps)
{
    console.log("CollectorAPS.setPotentialDestinations:");
    if (aps.planet.id !== aps.base.id)
    {
        // set base as only potential destination, if we are at a source
        this.setSinks(aps);
        console.log("...for collector at a (source) planet...");
        aps.potDest = this.sinks;

    } else
    {
        // if we are at base (sink), set sources as potential destinations
        this.setSources(aps);
        console.log("...for collector at base (sink)...");
        aps.potDest = this.sources;
    }
    if (aps.potDest.length === 0)
    {
        console.log("...no destinations available!");
    } else
    {
        console.log(aps.potDest);
    }
};
CollectorAPS.prototype.setSecondaryDestination = function(aps)
{
    // maybe useful when fuel is scarce?
};
CollectorAPS.prototype.setPotentialWaypoints = function(aps)
{
    let pwps = autopilot.frnnOwnPlanets; // necessary to prevent frnnOwnPlanets from being modified by modification of aps.potentialWaypoints
    aps.potentialWaypoints = pwps;
};
CollectorAPS.prototype.evaluateMissionDestinations = function(aps)
{
    let filteredDest = [];
    console.log("...filtering collector destinations: " + aps.potDest.length);
    for (let i = 0; i < aps.potDest.length; i++)
    {
        if (aps.potDest[i].pid !== aps.base.id)
        {
            let c = autopilot.getColony(aps.potDest[i].pid);
            if ((this.isMineralCollector(aps) && c.hasStarbase && !c.isFort) || c.isBuildingBase)
            {
                console.log("...removing destination " + c.planet.id + ": hasNoneFortBase || isBuildingBase");
                continue;
            }
            let isHub = (c.planet.note && c.planet.note.body.match(/nup:hub/));
            // if potential destination is the base of another APS
            if (aps.isAPSbase(c.planet.id))
            {
                // the base is employing APS of the same type (collector with priority x)
                if (aps.baseHasSameAPStype(c.planet.id, "col", aps.objectOfInterest) && !isHub && !c.isFort)
                {
                    console.log("...removing destination " + c.planet.id + ": mission conflict");
                    continue;
                }
            }
        }
        filteredDest.push(aps.potDest[i]);
    }
    aps.potDest = filteredDest;
};
CollectorAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS)
    {
        let c = autopilot.getColony(potPlanet.id, true);
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        //
        // only count as conflict if there is not enough resources available
        //
        let sumOfAllCargo = this.getSumOfOOI(aps, conflictAPS);
        sumOfAllCargo += aps.minCapacity;
        return (sumOfAllCargo >= c.getAPSCargo(aps));
    }
};
CollectorAPS.prototype.confirmMission = function (aps)
{
    console.log("Current capacity %s = max capacity %s", aps.getCurCapacity(), aps.maxCapacity);
    if (aps.getCurCapacity() === 0)
    {
        aps.potDest = [ autopilot.getColony(aps.base.id) ];
        aps.setMissionDestination();
        aps.initAPScontrol();
    }
};
CollectorAPS.prototype.postActivationHook = function (aps)
{

};
CollectorAPS.prototype.missionCompleted = function(aps)
{
    // collector does not use secondary destination.
    // Picking up resources at a source is a mission, and delivering it to base is another mission
    // Thus, mission is always completed, if at destination
    return true;
};
CollectorAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    let next = this.getNextPrimaryDestination(aps, ctP);
    if (next)
    {
        return next;
    } else
    {
        return aps.base;
    }
};
CollectorAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    if (ctP.id === aps.base.id)
    {
        this.setSources(aps);
        if (this.sources.length > 0)
        {
            return this.sources[0].planet;
        } else
        {
            return false;
        }
    } else
    {
        return aps.base;
    }
};
/*
    INTERNAL METHODS
 */
CollectorAPS.prototype.setSinks = function(aps)
{
    // as collector, the base is always the sink
    this.sinks = [ autopilot.getColony(aps.base.id) ];
};
CollectorAPS.prototype.setScopeRange = function(aps)
{
    if (this.scopeRange === "auto")
    {
        let inRange = aps.getAPSinRange(aps.simpleRange); // uses default: simpleRange
        if (inRange && inRange.length > 4 || aps.objectOfInterest === "cla")
        {
            aps.scopeRange = aps.simpleRange * 3;
        } else if (inRange && inRange.length > 2)
        {
            aps.scopeRange = aps.simpleRange * 2;
        }
    } else
    {
        aps.scopeRange = parseInt(this.scopeRange);
    }

};
CollectorAPS.prototype.isMineralCollector = function(aps)
{
    return (aps.objectOfInterest === "dur" || aps.objectOfInterest === "tri" || aps.objectOfInterest === "mol");
};
CollectorAPS.prototype.getCapacitySources = function(aps, colonies)
{
    let sources = [];
    let obj = aps.moveables[aps.objectOfInterest];
    let maxSources = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        if (oiBalance >= aps.maxCapacity) c.sourceType.push("max");
        if (obj === "megacredits") return oiBalance >= 1000;
        return (oiBalance >= aps.maxCapacity);
    });
    let minSources = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        if (oiBalance >= aps.minCapacity && oiBalance < aps.maxCapacity) c.sourceType.push("min");
        if (obj === "megacredits") return false;
        return (oiBalance >= aps.minCapacity && oiBalance < aps.maxCapacity);
    });
    let sinkC = autopilot.getColony(aps.base.id);
    let closer2Enemy = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        let curDist2closestEnemyPlanet = c.getDistanceToEnemyPlanet();
        let sinkDist2closestEnemyplanet = sinkC.getDistanceToEnemyPlanet();
        if (curDist2closestEnemyPlanet > 0 && (sinkDist2closestEnemyplanet === false || curDist2closestEnemyPlanet < sinkDist2closestEnemyplanet) && oiBalance >= aps.minCapacity) c.sourceType.push("close2enemy");
        if (obj === "megacredits") return (curDist2closestEnemyPlanet > 0 && (sinkDist2closestEnemyplanet === false || curDist2closestEnemyPlanet < sinkDist2closestEnemyplanet) && oiBalance >= 1000);
        return (curDist2closestEnemyPlanet > 0 && (sinkDist2closestEnemyplanet === false || curDist2closestEnemyPlanet < sinkDist2closestEnemyplanet) && oiBalance >= aps.minCapacity);
    });
    let closer2EnemyIds = closer2Enemy.map(function (c) {
        return c.planet.id;
    });
    let lowSources = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        if (oiBalance < aps.minCapacity) c.sourceType.push("low");
        if (obj === "megacredits") return false;
        return (oiBalance < aps.minCapacity);
    });
    console.log("Found %s full capacity sources.", maxSources.length);
    console.log("Found %s minimum capacity sources.", minSources.length);
    console.log("Found %s close2Enemy sources", closer2Enemy.length);
    console.log("Found %s sources with insufficient resources", lowSources.length);

    let etaRange = Math.ceil(aps.scopeRange / aps.simpleRange);
    //console.log("ETA range = " + etaRange);
    //console.log(maxSources.filter(function(s) { return s.eta === 1 }));

    if (closer2Enemy.length > 0 && maxSources.length < 1)
    {
        sources = sources.concat(closer2Enemy.sort(function (a, b) {
            return a.getDistanceToEnemyPlanet() - b.getDistanceToEnemyPlanet();
        }));
    }

    for (let i = 1; i <= etaRange; i++)
    {
        if (maxSources.length > 0) sources = sources.concat(maxSources.filter(function(s) { return s.eta2Source === i && closer2EnemyIds.indexOf(s.planet.id) === -1 }).sort(function (a, b) { return a.distance2APS - b.distance2APS }));
        if (minSources.length > 0) sources = sources.concat(minSources.filter(function(s) { return s.eta2Source === i && closer2EnemyIds.indexOf(s.planet.id) === -1 }).sort(function (a, b) { return b.balance[obj] - a.balance[obj] }));
    }

    if (sources.length < 5 && lowSources.length > 0)
    {
        lowSources = lowSources.filter(function (c) {
            return c.getAPSCargo(aps) >= aps.minCapacity;
        });
        lowSources.sort(function (a, b) {
            return b.balance[obj] - a.balance[obj];
        });
        sources = sources.concat(lowSources);
    }
    return sources;
};
CollectorAPS.prototype.setSources = function(aps)
{
    this.setScopeRange(aps);
    let potColonies = [];
    autopilot.frnnOwnPlanets.forEach(function (p) {
        let curC = autopilot.getColony(p.id, true);
        curC.distance2APS = aps.getDistance(p.x, p.y);
        curC.eta2Source = Math.ceil(aps.getDistance(p.x, p.y) / aps.simpleRange);
        if (curC.isCollectorSource(aps)) potColonies.push(curC);
    });
    let targetsInRange = potColonies.filter(function (c) {
        return c.distance2APS <= aps.scopeRange;
    });
    if (targetsInRange.length === 0)
    {
        aps.scopeRange *= 2;
        targetsInRange = potColonies.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        targetsInRange.sort(function (a, b) {
            return a.distance2APS - b.distance2APS;
        });
        potColonies.push(targetsInRange[0], targetsInRange[1]);
    } else {
        potColonies = targetsInRange;
    }
    console.log("Potential sources:");
    console.log(potColonies);
    if (potColonies.length > 0)
    {
        this.sources = this.getCapacitySources(aps, potColonies);
    }
};
CollectorAPS.prototype.getSumOfOOI = function(aps, conflictAPS)
{
    let sum = 0;
    for (let i = 0; i < conflictAPS.length; i++)
    {
        let cAPS = conflictAPS[i];
        if (cAPS.destination === cAPS.base)
        {
            sum -= vgap.getShip(cAPS.sid)[aps.moveables[cAPS.ooiPriority]];
        } else
        {
            sum += aps.maxCapacity;
        }
    }
    return sum;
};
CollectorAPS.prototype.getLoadingSequence = function(aps)
{
    let bSequence = [];
    let lSequence = [];
    if (aps.objectOfInterest === "dur")
    {
        lSequence = ["duranium"];
        bSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "tri", value: parseInt(aps.base.tritanium) } ];
    } else if (aps.objectOfInterest === "tri")
    {
        lSequence = ["tritanium"];
        bSequence = [ { res: "mol", value: parseInt(aps.base.molybdenum) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
    } else if (aps.objectOfInterest === "mol")
    {
        lSequence = ["molybdenum"];
        bSequence = [ { res: "tri", value: parseInt(aps.base.tritanium) }, { res: "dur", value: parseInt(aps.base.duranium) } ];
    }
    // determine the (remaining) loading sequence by what is needed at base (sink)
    bSequence.sort(function (a, b) {
        return a.value - b.value;
    });
    bSequence.forEach(function(seq){ lSequence.push(aps.moveables[seq.res]); });
    return lSequence;
};
CollectorAPS.prototype.loadMinerals = function(aps)
{
    let curCargo = 0;
    let bC = autopilot.getColony(aps.base.id, true); // base colony
    let pC = autopilot.getColony(aps.planet.id); // source colony
    if (pC.isOwnPlanet)
    {
        if (bC.isBuildingBase) // load what's needed to build the base
        {
            if (bC.balance.duranium < 0 || bC.balance.tritanium < 0 || bC.balance.molybdenum < 0)
            {
                let lSeq = ["duranium", "tritanium", "molybdenum"];
                for (let i = 0; i < lSeq.length; i++)
                {
                    if (bC.balance[lSeq[i]] < 0) curCargo += aps.loadObject(lSeq[i], aps.planet, (bC.balance[lSeq[i]]*-1));
                }
            }
        }
        //
        // check which minerals to prioritize...
        let loadingSequence = this.getLoadingSequence(aps);
        // load in sequence
        for (let j = 0; j < loadingSequence.length; j++)
        {
            curCargo += aps.loadObject(loadingSequence[j], aps.planet);
        }
    } else
    {
        console.error("Colony does not exist: " + aps.base.id + " " + aps.planet.id);
    }
    return curCargo;
};
CollectorAPS.prototype.loadCargo = function(aps) // not called at BASE
{
    let loaded = 0;
    // mineral handling
    if (this.isMineralCollector(aps) && aps.getCurCapacity() > 0)
    {
        console.log("...loading minerals...");
        loaded = this.loadMinerals(aps);
    } else if (aps.getCurCapacity(aps.moveables[aps.objectOfInterest]) > 0)
    {
        console.log("...loading other stuff...");
        loaded = aps.loadObject(aps.moveables[aps.objectOfInterest], aps.planet);
    }

    if (aps.objectOfInterest !== "megacredits")
    {
        let curC = autopilot.getColony(aps.planet.id, true);
        // we generally collect megacredits if option is active
        if (this.alwaysLoadMC && !curC.hasStarbase || (curC.hasStarbase && curC.isFort))
        {
            // are we transforming supplies to MCs first?
            if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid"))
            {
                curC.sellSupply(true);
            }
            loaded += aps.loadObject("megacredits", aps.planet);
        }
    }
    return loaded;
};/*
 * nuPilot - Distributor Module
 *
 *      https://github.com/drgirasol/nupilot/wiki/Distributor
 *
 */
function DistributorAPS()
{
    this.minimalCargoRatioToGo = parseFloat(autopilot.settings.disMinCapacity); // in percent of cargo capacity (e.g. 0.7 = 70%)
    this.scopeRange = autopilot.settings.disScopeRange;
    //this.cruiseMode = "safe"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    // data container
    this.sources = [];
    this.sinks = [];
}
/*
    GENERAL REQUIRED METHODS
 */
DistributorAPS.prototype.handleCargo = function (aps) // called once on initialization and a second time with aps.confirmMission
{
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.destination.id === aps.planet.id) // unload cargo when at destination
        {
            aps.unloadCargo();
            aps.unloadFuel();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id) // load cargo if we are at secondary destination
        {
            aps.unloadCargo(); // toDo: in case we picked up something on the way?
            let dC = autopilot.getColony(aps.destination.id, true);
            if (dC.getDistributorDemand(aps.objectOfInterest).length > 0)
            {
                this.loadCargo(aps); // load cargo
            } else // there is no demand left, set primary destination to current planet => choose another destination
            {
                aps.lastDestination = aps.secondaryDestination;
                aps.secondaryDestination = false;
                aps.destination = aps.planet;
            }
        } else // transit planet or former destination (primary or secondary)
        {
            // unload if at former destination
            if (aps.lastDestination && aps.planet.id === aps.lastDestination.id)
            {
                aps.unloadCargo();
                aps.unloadFuel();
            }

            if (aps.secondaryDestination)
            {
                // only load if secondary destination is closer to destination
                let dist2dest = aps.getDistance(aps.destination.x, aps.destination.y);
                let secDist2dest = 0;
                if (aps.secondaryDestination)
                {
                    let c = autopilot.getColony(aps.secondaryDestination.id);
                    secDist2dest = c.getDistance(aps.destination);
                }

                if (secDist2dest <= dist2dest)
                {
                    this.loadCargo(aps); // load available stuff and update demand
                    if (aps.demand.length === 0 && aps.secondaryDestination)
                    {
                        // no demand left but secondary destination set, delete
                        console.log("No demand left, reset secondary destination!");
                        aps.secondaryDestination = false;
                    }
                }
            } else
            {
                this.setDemand(aps);
                if (aps.demand.length > 0) {
                    this.loadCargo(aps);
                } else
                {
                    // no demand left, need new destination
                    aps.lastDestination = aps.secondaryDestination;
                    aps.secondaryDestination = false;
                    aps.destination = aps.planet;
                }
            }
        }
    }
};
DistributorAPS.prototype.setDemand = function (aps, destination)
{
    if (typeof destination === "undefined") destination = aps.destination;
    aps.demand = []; // reset
    let dC = autopilot.getColony(destination.id, true);
    if (dC)
    {
        let cD = dC.getAPSDemand(aps);
        cD.forEach(
            function (d, index) {
                if (aps.ship[d.item] < d.value)
                {
                    aps.demand.push( {
                        item: d.item,
                        value: (d.value - aps.ship[d.item])
                    } );
                }
            }
        );
    }
};
DistributorAPS.prototype.setPotentialDestinations = function(aps)
{
    if (this.sinks.length === 0) {
        this.setSinks(aps);
    }
    if (this.sinks.length < 1)
    {
        console.warn("No sinks available!");
        aps.isIdle = true;
    } else {
        aps.potDest = this.sinks;
        aps.isIdle = false;
    }
    aps.updateStoredData();
};
DistributorAPS.prototype.setSecondaryDestination = function(aps)
{
    // do we need a secondary destination?
    // check if ship cargo or planet contains the required amount for sink (destination)
    this.setScopeRange(aps);
    this.loadCargo(aps);
    if (aps.demand.length > 0)
    {
        if (aps.getCargoCapacity() < 1) {
            console.log("...full capacity reached! Proceed to destination!");
            if (aps.secondaryDestination) aps.secondaryDestination = false;
            return;
        }
        // check demand
        let dC = autopilot.getColony(aps.destination.id, true);

        console.log("...current status of demand >>");
        console.log(aps.demand);

        let potSource = this.pickSource(aps, dC, false);
        if (potSource)
        {
            if (potSource.distance2APS > dC.distance2APS && aps.getCurCapacity(aps.objectOfInterest) <= aps.minCapacity)
            {
                console.log("...we are closer to destination and have minCapacity on board, proceed to destination!");
            } else
            {
                aps.secondaryDestination = vgap.getPlanet(potSource.planet.id);
                console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
                //aps.setShipTarget();
            }
        } else {
            // no secondary destination (sufficient source) found
            console.log("...couldn't find an adequate secondary destination.");
            aps.idle = true;
            if (aps.idleReason.indexOf("No source found") === -1) aps.idleReason.push("No source found");
        }
    } else
    {
        console.error("...we don't need anything, sir.");
        // if (aps.secondaryDestination) aps.secondaryDestination = false;
        //aps.destination = false;
    }
};
DistributorAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
DistributorAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // no module specific filtering
};
DistributorAPS.prototype.hasMissionConflict = function(aps, potPlanet, secondary)
{
    // returns stored data for APS that also visit potPlanet with the same mission
    if (typeof secondary === "undefined") secondary = false;
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id, "dis", aps.objectOfInterest, secondary);
    return (conflictAPS.length > 0);
};
DistributorAPS.prototype.confirmMission = function (aps)
{
    if (aps.planet && aps.destination.id === aps.planet.id && !aps.secondaryDestination)
    {
        console.warn("DistributorAPS.confirmMission: WE ARE AT DESTINATION PLANET WITHOUT SECONDARY DESTINATION SET...!");
    }
    if (!aps.targetIsSet())
    {
        aps.setMissionDestination();
        aps.initAPScontrol();
    }
    // toDo: if a secondary destination is set, check if this is still the best choice
};
DistributorAPS.prototype.postActivationHook = function (aps)
{

};
DistributorAPS.prototype.missionCompleted = function(aps)
{
    // distributor uses secondary destination.
    // Picking up resources from a source and delivering it to the sink is ONE mission
    // Thus, mission is completed, if current destination does not have demand
    this.setDemand(aps);
    return (aps.demand.length === 0 || aps.demand[0].value < aps.minCapacity);
};
DistributorAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    let ctC = autopilot.getColony(ctP.id, true);
    let nextDemands = ctC.getNextAPSDemand(aps, aps.demand);
    if (nextDemands.length === 0)
    {
        return false;
    } else
    {
        let dC = autopilot.getColony(aps.destination.id, true);
        let source = this.pickSource(aps, dC, ctP, nextDemands);
        if (source)
        {
            console.log("...next secondary destination:", source.planet.id);
            return source.planet;
        } else {
            // return base planet if no secondary destination could be found
            console.log("...next secondary destination: base => ", aps.base.id);
            return aps.base;
        }
    }
};
DistributorAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    this.setScopeRange(aps);
    let priorityList = this.classifySinks(aps);
    if (priorityList.length > 0)
    {
        console.log("...next target is new destination", priorityList[0].planet);
        return priorityList[0].planet;
    } else
    {
        console.log("...next target is BASE", aps.base);
        return aps.base;
    }
};
/*
    INTERNAL METHODS
 */
DistributorAPS.prototype.setScopeRange = function(aps)
{
    if (this.scopeRange === "auto")
    {
        let inRange = aps.getAPSinRange(aps.simpleRange);
        if (inRange && inRange.length > 4)
        {
            aps.scopeRange = aps.simpleRange * 2;
        }
    } else
    {
        aps.scopeRange = parseInt(this.scopeRange);
    }
};
DistributorAPS.prototype.setSinks = function(aps)
{
    this.setScopeRange(aps);
    this.sinks = this.classifySinks(aps);
    console.warn("FINAL SINKS >>");
    console.log(this.sinks);
};
DistributorAPS.prototype.classifySinks = function(aps)
{
    let potentials = [];
    let classified = [];
    let potSinks = this.getPotentialSinks(aps); // colonies
    if (potSinks.length > 0)
    {
        console.log("POTENTIAL SINKS FOUND >> " + potSinks.length);
        console.log(potSinks);
        let self = this;
        // classify according to resources and natives
        if (aps.objectOfInterest === "cla")
        {
            let postFeudalNativeSites = potSinks.filter(function (c) {
                return c.planet.nativegovernment > 5 && c.curDist2Aps <= aps.scopeRange && self.pickSource(aps, c);
            });
            let filteredIds = postFeudalNativeSites.map(function (c) {
                return c.planet.id;
            });
            let bovinoidNativeSites = potSinks.filter(function (c) {
                return c.planet.nativeracename === "Bovinoid" && c.curDist2Aps <= aps.scopeRange && self.pickSource(aps, c);
            });
            filteredIds = bovinoidNativeSites.map(function (c) {
                return c.planet.id;
            });
            let tecNativeSites = potSinks.filter(function (c) {
                return filteredIds.indexOf(c.planet.id) === -1 && c.hasTecRace && c.curDist2Aps <= aps.scopeRange && self.pickSource(aps, c);
            });
            filteredIds.concat(tecNativeSites.map(function (c) {
                return c.planet.id;
            }));
            let otherNativeSites = potSinks.filter(function (c) {
                return filteredIds.indexOf(c.planet.id) === -1 && c.planet.nativegovernment <= 5 && c.curDist2Aps <= aps.scopeRange && self.pickSource(aps, c);
            });
            classified = [].concat(postFeudalNativeSites, bovinoidNativeSites, tecNativeSites, otherNativeSites);
        } else if (aps.objectOfInterest === "neu")
        {
            classified = potSinks.filter(function (c) {
                return c.curDist2Aps <= aps.scopeRange && self.pickSource(aps, c);
            });
            classified.sort(function (a, b) {
                return a.balance.neutronium - b.balance.neutronium;
            });
        }
        if (classified.length < 1)
        {
            let outsideScope = potSinks.filter(function (c) {
                return c.curDist2Aps > aps.scopeRange && self.pickSource(aps, c);
            });
            if (outsideScope.length > 0) {
                while (classified.length < 3 && outsideScope.length > 0)
                {
                    let curC = outsideScope.shift();
                    if (this.pickSource(aps, curC))
                    {
                        classified.push( curC );
                    }
                }
            } // add two sinks that are outside scope range as backup
        }
    } else
    {
        console.warn("NO POTENTIAL SINKS FOUND!");
    }
    return classified;
};
DistributorAPS.prototype.getPotentialSinks = function(aps)
{
    let potSinks = [];
    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id, true);
        let demand = c.getAPSDemand(aps);
        if (demand.length > 0 && demand[0].value > (aps.minCapacity * 0.5))
        {
            console.log("...demand of colony %d:", c.planet.id, c.getAPSDemand(aps));
            potSinks.push(c);
        }
    }
    if (potSinks.length > 0)
    {
        potSinks.forEach(function (c) {
            c.curDist2Aps = c.getDistance(aps.ship);
            c.curEtaOfAps = Math.ceil(c.getDistance(aps.ship) / aps.simpleRange);
        });
        potSinks.sort(function (a, b) {
            return a.curDist2Aps - b.curDist2Aps;
        });
    }
    return potSinks;
};
DistributorAPS.prototype.getSources = function(aps, sink)
{
    console.log("DistributorAPS.getSources:", sink);
    // get sources
    // (a) between here and there (closer or same turn distance)
    // OR
    // (b) within scopeRange of the site
    //
    let potColonies = [];
    let here2sinkTurnDist = Math.ceil(aps.getDistance(sink.planet.x, sink.planet.y, false) / aps.simpleRange);
    let scopeTurnDist = Math.ceil(aps.scopeRange / aps.simpleRange);
    //console.log("Distance (turns) to site (%s): %s", sink.planet.id, here2sinkTurnDist);
    //
    if ((aps.planet && aps.planet.id === sink.planet.id) || here2sinkTurnDist <= scopeTurnDist) // if we are at site, or are within the scope of the site => (b)
    {
        this.setScopeRange(aps);
        let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
        if (aps.planet && aps.planet.id !== sink.planet.id) targetsInRange.push(aps.planet); // add current planet if we are within the scope of the site
        //
        console.log("...found %s potential sources within %s lys:", targetsInRange.length, aps.scopeRange, targetsInRange);
        //
        if (targetsInRange.length > 0)
        {
            targetsInRange.forEach(
                function (t, index) {
                    let curC = autopilot.getColony(t.pid, true);
                    curC.distance2APS = aps.getDistance(curC.planet.x, curC.planet.y);
                    curC.curDistributorCargo = curC.getAPSCargo(aps);
                    if (curC.isDistributorSource(aps) && curC.determineSafety()) potColonies.push( curC );
                }
            );
        }
    } else // if we are somewhere else => (a)
    {
        vgap.myplanets.forEach(
            function (p, index) {
                if ((aps.planet && p.id === aps.planet.id) || p.id === sink.id) return; // skip current and destination planet
                let src2sinkTurnDist = Math.ceil(autopilot.getDistance( { x: p.x, y: p.y }, { x: sink.planet.x, y: sink.planet.y }, false ) / aps.simpleRange);
                console.log("Turn distance from source %s to sink: %s", p.id, src2sinkTurnDist);
                let curC = autopilot.getColony(p.id, true);
                curC.distance2APS = aps.getDistance(curC.planet.x, curC.planet.y);
                curC.curDistributorCargo = curC.getAPSCargo(aps);
                if (src2sinkTurnDist <= here2sinkTurnDist && curC.isDistributorSource(aps) && curC.determineSafety()) potColonies.push( curC );
            }
        );
    }
    return potColonies;
};
DistributorAPS.prototype.getClassifiedSources = function(aps, site, sources, demands)
{
    console.log("DistributorAPS.getClassifiedSources:", site);
    if (typeof demands === "undefined") demands = site.getAPSDemand(aps);
    console.log("...distributorDemands:", demands);
    demands.sort(function(a, b) {
        return b.value - a.value;
    });
    // SATISFYING SOURCES
    let satisfyingSources = sources.filter(function (c) {
        return c.satisfiesAPSDemand(aps, demands);
    });
    satisfyingSources.sort(function (a, b) {
        return a.distance2APS - b.distance2APS;
    });
    console.log("...satisfying sources:", satisfyingSources);
    // NOT SATIFYING BUT > MINIMUM CAPACITY
    let minimumSources = sources.filter(function (c) {
        return c.getAPSCargo(aps) >= aps.minCapacity && !c.satisfiesAPSDemand(aps, demands);
    });
    minimumSources.sort(function (a, b) {
        return a.distance2APS - b.distance2APS;
    });
    console.log("...minimum capacity sources:", minimumSources);
    return [].concat(satisfyingSources, minimumSources);
};
DistributorAPS.prototype.pickSource = function(aps, sink, excludePlanet, demands)
{
    console.log("DistributorAPS.pickSource: for site", sink);
    if (typeof excludePlanet === "undefined") excludePlanet = false;
    if (typeof demands === "undefined") demands = sink.getAPSDemand(aps);
    let source = false;
    let potColonies = this.getSources(aps, sink);
    console.log("DistributorAPS.pickSource: potColonies:", potColonies);
    if (potColonies.length > 0)
    {
        if (potColonies.length > 1)
        {
            let finalSourceCollection = this.getClassifiedSources(aps, sink, potColonies, demands);
            console.log("...finalSourceCollection:", finalSourceCollection);

            for (let i = 0; i < finalSourceCollection.length; i++)
            {
                if (this.hasMissionConflict(aps, finalSourceCollection[i].planet, true)) continue;
                if (excludePlanet && excludePlanet.id === finalSourceCollection[i].planet.id) continue;
                return finalSourceCollection[i];
            }
        }
        if (excludePlanet && excludePlanet.id === potColonies[0].planet.id) return false;
        if (!this.hasMissionConflict(aps, potColonies[0].planet, true)) return potColonies[0];
    }
    return source;
};
DistributorAPS.prototype.isSource = function(aps) // isSource is always FALSE for destination (always is a sink) and secondary destination (should always be a source, at least when selected)
{
    // has the current planet (=not primary or secondary destination) something to offer for
    if (aps.destination && aps.planet.id !== aps.destination.id && (!aps.secondaryDestination || aps.planet.id !== aps.secondaryDestination.id))
    {
        // the primary destination
        let cC = autopilot.getColony(aps.planet.id, true); // current colony
        if (cC.isOwnPlanet)
        {
            let obj = aps.moveables[aps.objectOfInterest];
            let dC = autopilot.getColony(aps.destination.id, true); // destination colony
            if ((dC.balance[obj] < 0 && cC.balance[obj] > 0)) return true;
        }
    }
    return false;
};
DistributorAPS.prototype.loadCargo = function(aps) // never called when at destination planet
{
    this.setDemand(aps);
    if (aps.demand.length > 0)
    {
        let loaded = 0;
        // calculate demand within range, load at least minCapacity
        let loadDemand = aps.minCapacity;
        let demandInRange = 0;
        // get colonies within range
        let scopeCols = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.destination.x, aps.destination.y, aps.scopeRange);
        scopeCols.forEach(function (t) {
            let p = vgap.planetAt(t.x, t.y);
            let c = autopilot.getColony(p.id, true);
            let demand = c.getAPSDemand(aps);
            if (demand.length > 0) demandInRange += demand[0].value;
        });
        if (demandInRange > loadDemand) loadDemand = demandInRange;
        if (loadDemand < aps.demand[0].value) loadDemand = aps.demand[0].value;
        loaded += aps.loadObject(aps.demand[0].item, aps.planet, loadDemand);
        this.setDemand(aps);
        return loaded;
    } else
    {
        return 0;
    }
};/*
 * nuPilot - Expansion Module
 * 
 *     
 *     
 */
function ExpanderAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
    //this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    // data container
    this.sources = [];
    this.sinks = [];
    this.expanderKit = false;
}
/*
    GENERAL REQUIRED METHODS
 */
ExpanderAPS.prototype.handleCargo = function (aps)
{
    if (aps.planet)
    {
        if (!aps.isOwnPlanet && (aps.destination.id === aps.planet.id || aps.planet.id === aps.lastDestination.id))
        {
            // = new colony
            let enemyAtPlanet = autopilot.enemyShipAtPlanet(aps.planet);
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
                    this.setSources(aps);
                    if (this.sources.length > 0)
                    {
                        aps.secondaryDestination = vgap.getPlanet(this.sources[0].pid);
                    } else
                    {
                        aps.secondaryDestination = false;
                        aps.destination = false;
                        aps.idle = true;
                    }
                }
                // else proceed
            }
        }
    }
};
ExpanderAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
ExpanderAPS.prototype.setPotentialDestinations = function(aps)
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
ExpanderAPS.prototype.setSecondaryDestination = function(aps)
{
    // check if cargo or planet contains expanderKit
    let planetKit = false;
    if (aps.planet)
    {
        planetKit = this.planetHasExpKit(aps);
    }
    if (!this.hasExpKit(aps) && !planetKit)
    {
        console.log("...insufficient cargo!");
        // unload remaining cargo to planet
        this.transferCargo(aps, true);
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
            let nextWaypoint = aps.getEtaWaypoint(aps.base); // toDo: this can be a very slow solution, since the smallest ETA is always first
            if (nextWaypoint)
            {
                aps.secondaryDestination = nextWaypoint;
            } else {

                aps.secondaryDestination = aps.base;
                let closestplanet = autopilot.getClosestPlanet(aps.ship, 0, false);
                if (closestplanet) aps.secondaryDestination = closestplanet;
            }
        }
    }
};
ExpanderAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets.concat(autopilot.frnnUnownedPlanets);
};
ExpanderAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // no module specific filtering
};
ExpanderAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS)
    {
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        return true;
    }
    let apsAtPlanet = autopilot.getAPSatPlanet(potPlanet);
    if (apsAtPlanet.length > 0)
    {
        //console.log(apsAtPlanet);
        let expanderAtPlanet = apsAtPlanet.filter(function (cfg) {
            console.log(aps.ship.id);
            return (cfg.shipFunction === "exp" && cfg.sid !== aps.ship.id);
        });
        if (expanderAtPlanet) return true;
    }
};
ExpanderAPS.prototype.confirmMission = function (aps)
{
    if (aps.isOwnPlanet)
    {
        if (aps.ship.friendlycode === "bdm") aps.ship.friendlycode = "xdm";
        if (aps.ship.mission === 10) aps.ship.mission = aps.oShipMission;
    }
};
ExpanderAPS.prototype.postActivationHook = function (aps)
{

};
ExpanderAPS.prototype.missionCompleted = function(aps)
{
    return true;
};
ExpanderAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    this.setSources(aps);
    if (this.sources.length > 0)
    {
        return vgap.getPlanet(this.sources[0].pid);
    } else {
        return false;
    }
};
ExpanderAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    this.setSinks(aps);
    if (this.sinks.length > 0) {
        return vgap.getPlanet(this.sinks[0].pid);
    } else {
        return aps.base;
    }
};
/*
    INTERNAL METHODS
 */
ExpanderAPS.prototype.getOtherColonizer = function(aps, p)
{
    /*
     *   Very early check if
     *   a) there is an expander on-site
     *   b) another expander is colonizing this site
     */
    let hasColonizer = false;
    let onSite = autopilot.getAPSatPlanet(p);
    if (onSite.length > 0)
    {
        for (let i = 0; i < onSite.length; i++)
        {
            if (onSite[i].shipFunction === "exp" && aps.ship.id !== onSite[i].sid)
            {
                hasColonizer = onSite[i];
                break;
            }
        }
    }
    if (hasColonizer) return hasColonizer;
    //
    let approaching = autopilot.getAPSwithDestination(p);
    //console.log(approaching);
    if (approaching.length > 0)
    {
        for (let j = 0; j < approaching.length; j++)
        {
            if (approaching[j].shipFunction === "exp" && aps.ship.id !== approaching[j].sid)
            {
                hasColonizer = approaching[j];
                break;
            }
        }
    }
    return hasColonizer;
};
ExpanderAPS.prototype.getClassifiedSinks = function(potSinks)
{
    let withNatives = potSinks.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    let temperate = potSinks.filter(function (c) {
        return c.planet.temp > 14 && c.planet.temp < 85 && c.planet.nativeclans === 0;
    });
    let others = potSinks.filter(function (c) {
        return (c.planet.temp <= 14 || c.planet.temp >= 85) && c.planet.nativeclans === 0;
    });
    let unexplored = potSinks.filter(function (c) {
        return c.planet.temp === -1;
    });
    return [].concat(withNatives).concat(temperate).concat(others).concat(unexplored);
};
ExpanderAPS.prototype.setSinks = function(aps)
{
    console.log("ExpanderAPS.setSinks:");
    this.setScopeRange(aps);
    let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    console.log("...targets in scope range:", targetsInRange);
    let potColonies = [];
    targetsInRange.forEach(function (pos) {
        let p = vgap.planetAt(pos.x, pos.y);
        let c = autopilot.getColony(p.id, true);
        c.curDist2Aps = c.getDistance(aps.ship);
        let ships = vgap.shipsAt(pos.x, pos.y);
        let willBcolonized = false;
        if (ships) {
            ships.forEach(function (s) {
                if (s.ownerid === vgap.player.id && s.transferclans > 0) willBcolonized = true;
            });
        }
        if (!willBcolonized) {
            let colShips = vgap.myships.filter(function (s) {
                return s.clans > 0;
            });
            if (colShips.length > 0)
            {
                colShips.forEach(function (s) {
                    if (s.targetx === pos.x && s.targety === pos.y) willBcolonized = true;
                });
            }
        }
        if (c.determineSafety() && !willBcolonized) potColonies.push(c);
    });
    potColonies.sort(function (a, b) {
        return a.curDist2Aps - b.curDist2Aps;
    });
    console.log("...potential colonies:", potColonies);
    let futureColonies = this.getClassifiedSinks(potColonies);
    if (futureColonies.length > 0)
    {
        console.log("...future colonies:", futureColonies);
        this.sinks = futureColonies;
    }
};
ExpanderAPS.prototype.setScopeRange = function(aps)
{
    aps.scopeRange = aps.simpleRange * 5;
};
ExpanderAPS.prototype.setSources = function(aps)
{
    let goodSources = [];
    let expanderCargo = this.getExpanderKit(aps, true);
    for (let i = 0; i < vgap.myplanets.length; i++)
    {
        let c = autopilot.getColony(vgap.myplanets[i].id, true);
        // we only look for sources, if the aps.planet does not offer anything, so we can exclude this colony (c) as potential source
        if (c.isOwnPlanet && aps.planet.id !== c.planet.id)
        {
            let clans = c.balance.clans;
            let supplies = c.balance.supplies;
            let mcs = c.balance.megacredits;

            if ( (clans >= (expanderCargo.cla * this.minimalCargoRatioToGo) && supplies >= (expanderCargo.sup * this.minimalCargoRatioToGo) ) || vgap.myplanets[i].id === aps.base.id) // ignore mcs; always add the base planet, regardless if everything is available
            //if ((clans >= cutOff.cla && supplies >= cutOff.sup && mcs >= cutOff.mcs) || sourcePlanet.id == aps.base.id) // always add the base planet, regardless if everything is available
            {
                let distance = Math.floor(autopilot.getDistance({x: c.planet.x, y: c.planet.y}, {x:aps.ship.x ,y:aps.ship.y}));
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
ExpanderAPS.prototype.isSource = function(planet)
{
    for (let i = 0; i < this.sources.length; i++)
    {
        if (this.sources[i].pid === planet.id) return true;
    }
    return false;
};
ExpanderAPS.prototype.setExpanderKit = function(aps)
{
    let clans = 0;
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
    let sups = aps.hull.cargo - clans;
    let mcs = 3 * (aps.hull.cargo - clans);
    this.expanderKit = {
        cla: clans,
        sup: sups,
        mcs: mcs
    };
};
ExpanderAPS.prototype.getExpanderKit = function(aps)
{
    if (!this.expanderKit) this.setExpanderKit(aps);
    return this.expanderKit;
};
ExpanderAPS.prototype.hasExpKit = function(aps)
{
    let expanderKit = this.getExpanderKit(aps);
    if (aps.objectOfInterest === "slw")
    {
        return ( (aps.ship.clans >= expanderKit.cla || aps.ship.clans >= 150) && (aps.ship.supplies >= expanderKit.sup || aps.ship.supplies >= 50) ); // ignore mcs, maximum 150 clans and 50 supply per planet
    } else
    {
        return ( aps.ship.clans >= 10 && aps.ship.supplies >= 10 ); // ignore mcs, maximum of 10 clans and 10 supply per planet
    }
};
ExpanderAPS.prototype.planetHasExpKit = function(aps, partially)
{
    let c = autopilot.getColony(aps.planet.id, true);
    if (c.isOwnPlanet)
    {
        let expExcSup = c.balance.supplies;
        if (c.hasStarbase) expExcSup = aps.planet.supplies - parseInt(autopilot.settings.defSupRetention); // overwrite balance if at SB
        let expExcMcs = c.balance.megacredits;
        if (c.hasStarbase) expExcMcs = aps.planet.megacredits - parseInt(autopilot.settings.defMcsRetention); // overwrite balance if at SB

        let expanderKit = this.getExpanderKit(aps);
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
ExpanderAPS.prototype.loadCargo = function(aps)
{
    let curCargo = 0;
    let curMCs = 0;
    let expanderKit = this.getExpanderKit(aps);
    if (this.hasExpKit(aps)) // ship has expander kit
    {
        return true;
    } else if (this.planetHasExpKit(aps, true)) // planet has expander kit
    {
        let kDiffCla = aps.ship.clans - expanderKit.cla;
        let kDiffSup = aps.ship.supplies - expanderKit.sup;
        let kDiffMcs = aps.ship.megacredits - expanderKit.mcs;
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
        return true;
    } else
    {
        console.log("...no Kit(s) available...");
    }
    return false;
};
ExpanderAPS.prototype.transferCargo = function(aps, unloadAll)
{
    if (typeof unloadAll === "undefined") unloadAll = false;

    if (aps.planet && !aps.isOwnPlanet && (aps.ship.transferclans < 1 || unloadAll))
    {
        let unloadingSequence = [ "supplies", "clans", "megacredits" ];
        let maxAmounts = [ 50, 150, 150]; // slow colonization kit
        if (aps.objectOfInterest === "fst")
        {
            maxAmounts = [ 10, 10, 30]; // fast colonization kit
            if (aps.planet.nativeracename === "Amorphous") return; // don't transfer to amorphous planets
        }
        if (unloadAll)
        {
            maxAmounts = [ aps.ship.supplies, aps.ship.clans, aps.ship.megacredits ];
        }
        if (!unloadAll)
        {
            // calculate clans for population growth and adapt transfer to that
            if (vgap.player.raceid === 7) // crystals
            {
                let popGrowth = aps.planet.temp / 100 * maxAmounts[1] / 20 * 5 / 5;
                if (popGrowth < 1)
                {
                    let newAmount = maxAmounts[1];
                    while (popGrowth < 1)
                    {
                        newAmount += 1;
                        popGrowth = aps.planet.temp / 100 * newAmount / 20 * 5 / 5;
                    }
                    if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
                }
            } else
            {
                if (aps.planet.temp > 15 && aps.planet.temp < 84)
                {
                    let popGrowth = aps.planet.temp * aps.planet.temp / 4000 * maxAmounts[1] / 20 * 5 / 5;
                    if (popGrowth < 1)
                    {
                        let newAmount = maxAmounts[1];
                        while (popGrowth < 1)
                        {
                            newAmount += 1;
                            popGrowth = aps.planet.temp * aps.planet.temp / 4000 * newAmount / 20 * 5 / 5;
                        }
                        if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
                    }
                }
            }
        }
        //
        for (let i = 0; i < unloadingSequence.length; i++)
        {
            let cargo = unloadingSequence[i];
            let amount = maxAmounts[i];
            if (parseInt(aps.ship[cargo]) <= amount)
            {
                amount = parseInt(aps.ship[cargo]);
            }
            aps.transferObject(cargo, aps.planet, amount);
        }
        if (aps.ship.megacredits > 0)
        {
            aps.ship.friendlycode = "bdm";
        }
    }
};/*
 *  nuPilot - Terraform Module
 */
function HizzzAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of 10000 MCs (e.g. 0.7 = 7000 MC)
    //this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    this.sellSupply = "notBov"; // true, false, "notBov" (true, but don't sell supply on Bovinoid planets)
    // data container
    this.sources = [];
    this.sinks = [];
}
/*
    GENERAL REQUIRED METHODS
 */
HizzzAPS.prototype.handleCargo = function (aps)
{
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.atBase) // we are at base (sink)
        {
            aps.unloadCargo();
        } else // source or waypoint
        {
            let weLoad = true;
            let otherHizzers = aps.destinationHasSameAPStype(aps.planet.id); // returns stored data for APS that also have planet as destination with the same mission
            if (otherHizzers.length > 0)
            {
                // check if other ship has better engines or lower id
                console.log("Current Hizzer %s with engineId %s?", aps.ship.id, aps.ship.engineid);
                let otherHizzerShips = [];
                otherHizzers.forEach(function (cfg) {
                    let s = vgap.getShip(cfg.sid);
                    if (s.x === aps.ship.x && s.y === aps.ship.y) // at the current planet?
                    {
                        otherHizzerShips.push(s);
                    }
                });
                console.log("Other Hizzers:");
                console.log(otherHizzerShips);
                if (otherHizzerShips.length > 0)
                {
                    let engineids = otherHizzerShips.map(function (s) {
                        return s.engineid;
                    });
                    engineids.push(aps.ship.engineid);
                    let uniqueEngines = [...new Set(engineids)];
                    console.log("uniqueEngines", uniqueEngines);
                    if (uniqueEngines.length > 1)
                    {
                        otherHizzerShips.sort(function (a, b) {
                            return b.engineid - a.engineid;
                        });
                        console.log("sorted other Hizzers", otherHizzerShips);
                        if (otherHizzerShips[0].engineid > aps.ship.engineid)
                        {
                            weLoad = false;
                        } else
                        {
                            // current Hizzer belongs to the fastest hizzers
                            let fastestHizzers = otherHizzerShips.filter(function (s) {
                                return s.engineid === aps.ship.engineid;
                            });
                            if (fastestHizzers.length > 0)
                            {
                                fastestHizzers.sort(function (a, b) {
                                    return a.id - b.id;
                                });
                                if (fastestHizzers[0].id < aps.ship.id) weLoad = false;
                            }
                        }
                    } else
                    {
                        // all Hizzers are equally fast
                        otherHizzerShips.sort(function (a, b) {
                            return a.id - b.id;
                        });
                        if (otherHizzerShips[0].id < aps.ship.id) weLoad = false;
                    }
                }
            }
            if (weLoad)
            {
                let loadLog = this.loadCargo(aps);
                console.log("We are loading...");
                console.log(loadLog);
                if (aps.planet.id === aps.destination.id && this.missionCompleted(aps))
                {
                    aps.destination = aps.base;
                }
            } else
            {
                console.log("We are unloading...");
                aps.unloadCargo();
            }
        }
    }
};
HizzzAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
HizzzAPS.prototype.setPotentialDestinations = function(aps)
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
    } else if (aps.planet)
    {
        // set base as only potential destination, if we are at a source
        console.log("...for hizzer at a (source) planet...");
        aps.potDest = this.sinks;
    } else
    {
        aps.potDest = [ autopilot.getColony(aps.base.id) ];
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
HizzzAPS.prototype.setSecondaryDestination = function(aps)
{
    //aps.secondaryDestination = false;
};
HizzzAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
HizzzAPS.prototype.evaluateMissionDestinations = function(aps)
{
    console.log("...filtering HIZZER destinations: " + aps.potDest.length);
    console.log(aps.potDest);
    aps.potDest = aps.potDest.filter(function (c) {
        if (c.planet.id !== aps.base.id) return !c.isBuildingBase && !c.hasStarbase;
        return true;
    });
};
HizzzAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS)
    {
        console.log("There are %s Hizzzer at planet %s", conflictAPS.length, potPlanet.id);
        let fromOtherBase = 0;
        conflictAPS.forEach(function (cfg) {
            if (cfg.base !== aps.base.id) fromOtherBase ++;
        });
        console.log("%s Hizzer are from another Base.", fromOtherBase);
        if (fromOtherBase > 2) return true;
        //
        // toDo: how many hizzers can be employed at a planet?
        // compare true revenue with potential revenue
        let c = autopilot.getColony(potPlanet.id);
        let trueRevenue = c.getRevenue();
        let potentialRevenue = c.getRevenue(c.taxation);
        let diff = trueRevenue / potentialRevenue;
        console.log("The planets true revenue %s vs. the planets potential revenue %s", trueRevenue, potentialRevenue);
        if (diff < 0.5) return conflictAPS.length >= 1; // allow only one additional hizzzer
        return (conflictAPS.length >= 12);
    }
};
HizzzAPS.prototype.confirmMission = function (aps)
{
    console.log("Setting ship " + aps.ship.id + " mission: Hizzz!");
    aps.ship.mission = 8;
};
HizzzAPS.prototype.postActivationHook = function (aps)
{
    console.log("Setting ship " + aps.ship.id + " mission: Hizzz!");
    // colony taxation
    //aps.initAPScontrol(); // update APSbyPlanet
    aps.ship.mission = 8;
    if (aps.planet)
    {
        autopilot.getColony(aps.planet.id);
    }
};
HizzzAPS.prototype.missionCompleted = function(aps)
{
    // hizzer does not use secondary destination.
    // Collecting MCs after hizzing or just hizzing the base planet is the mission
    // Thus,
    //      in case we are at base, mission is completed, if a more valuable planet is in scope range and no mission conflict exists
    //      in case we are at another location, mission is complete, if more then the minimum capacity in MCs is available
    if (aps.planet && aps.base.id === aps.planet.id)
    {
        return this.getBetterPotentialSources(aps);
    } else
    {
        return aps.ship.megacredits >= aps.minCapacity || this.hasMissionConflict(aps, aps.planet);
    }
};
HizzzAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    return false;
};
HizzzAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
   return false;
};
/*
    INTERNAL METHODS
 */
HizzzAPS.prototype.loadCargo = function(aps)
{
    if (aps.destination.id === aps.planet.id || (aps.planet.id === aps.lastDestination.id && aps.base.id !== aps.planet.id))
    {
        if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid"))
        {
            let curC = autopilot.getColony(aps.planet.id, true);
            curC.sellSupply(true);
        }
        let loaded = aps.loadObject("megacredits", aps.planet, Math.floor(aps.planet.megacredits * 0.75));
        return { item: "megacredits", value: loaded };
    } else
    {
        // always collect cash from intermediate stops, as long as there is no starbase
        // toDo: not all starbases need cash...
        let c = autopilot.getColony(aps.planet.id, true);
        if (!c.hasStarbase)
        {
            let loaded = aps.loadObject("megacredits", aps.planet, c.balance.megacredits);
            return { item: "megacredits", value: loaded };
        }
    }
};
HizzzAPS.prototype.setSinks = function(aps)
{
    // as hizzzer, the base is always the sink
    this.sinks = [ autopilot.getColony(aps.base.id) ];
};
HizzzAPS.prototype.setScopeRange = function(aps)
{
    let inRange = aps.getAPSinRange(aps.scopeRange);
    if (inRange && inRange.length > 3)
    {
        aps.scopeRange *= 3;
    } else
    {
        aps.scopeRange *= 2;
    }
};
HizzzAPS.prototype.getBetterPotentialSources = function(aps)
{
    // check if a better source is available
    let c = autopilot.getColony(aps.planet.id);
    let curRevenue = c.getRevenue(c.taxation);
    this.setSources(aps);
    console.log("Are there better sources available?");
    let _this = this;
    return this.sources.filter(function (ps) {
        let potRevenue = ps.getRevenue(ps.taxation);
        console.log("Potential revenue at planet %s = %s", ps.planet.id, potRevenue);
        return ps.planet.id !== aps.planet.id && potRevenue > curRevenue && !_this.hasMissionConflict(aps, ps.planet);
    });
};
HizzzAPS.prototype.getSources = function(aps)
{
    this.setScopeRange(aps);
    let potColonies = [];
    console.log("Base of APS %s = %s", aps.ship.id, aps.base.id);
    let planetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.scopeRange);
    if (aps.planet && aps.planet.id === aps.base.id) planetsInRange.push(aps.planet); // add base planet if we are at base
    console.log("Targets in range:");
    console.log(planetsInRange);
    let self = this;
    planetsInRange.forEach(function (p) {
        let curC = autopilot.getColony(p.id, true);
        curC.distance2APS = aps.getDistance(p.x, p.y);
        curC.eta2Source = Math.floor(aps.getDistance(p.x, p.y) / aps.simpleRange);
        if (curC.isHizzzerSource(aps) && !self.hasMissionConflict(aps, curC.planet)) potColonies.push(curC);
    });
    return potColonies;
};
HizzzAPS.prototype.setSources = function(aps)
{
    // as hizzzer, each planet with taxable population is a source
    // and the object of interest is to produce MCs and transport them to the base
    // priority are planets that generate most MCs
    let potColonies = this.getSources(aps);
    //
    console.log("Potential sources:");
    console.log(potColonies);
    //
    let withEnligthenedNatives = potColonies.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous" && c.planet.nativegovernment > 5;
    });
    let withPrimitiveNatives = potColonies.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous" && c.planet.nativegovernment <= 5;
    });
    let withoutNatives = potColonies.filter(function (c) {
        return c.planet.nativeclans === 0 && c.planet.clans > 1000;
    });
    //
    this.sources = [].concat(withEnligthenedNatives.sort(function (a, b) {
        return b.planet.nativegovernment - a.planet.nativegovernment;
    })).concat(withPrimitiveNatives.sort(function (a, b) {
        return b.planet.nativegovernment - a.planet.nativegovernment;
    })).concat(withoutNatives.sort(function (a, b) {
        return b.planet.clans - a.planet.clans;
    }));
    this.sources.sort(function (a, b) {
        return b.revenue - a.revenue;
    });
};
HizzzAPS.prototype.isSource = function(planet)
{
    let c = autopilot.getColony(planet.id);
    return (c.getRevenue() > 100);
};
HizzzAPS.prototype.transferCargo = function(aps)
{

};/*
 *  nuPilot - Terraform Module
 *
 *
 */
function TerraformerAPS()
{
    this.minimalCargoRatioToGo = 0.5; // in percent of cargo capacity (e.g. 0.7 = 70%)
    //this.cruiseMode = "fast"; // safe = 1-turn-connetions, fast = direct if faster, direct = always direct
    //this.energyMode = "conservative"; // conservative = use only the required amount of fuel, moderate = use 20 % above required amount, max = use complete tank capacity
    // data container
    this.sources = [];
    this.sinks = [];
}
/*
    MANDATORY METHODS - called from APS
 */
TerraformerAPS.prototype.handleCargo = function (aps)
{

};
TerraformerAPS.prototype.setDemand = function (aps)
{
    aps.demand = []; // reset
};
TerraformerAPS.prototype.setPotentialDestinations = function(aps)
{
    console.log("Determine potential destinations...");
    this.setSinks(aps);
    if (this.getMissionStatus(aps) < 0)
    {
        console.log("Terraforming status: " + this.getMissionStatus(aps));
        if (this.sinks.length > 0)
        {
            if (this.getMissionStatus(aps) <= this.sinks[0].deficiency) return; // don't go anywhere as long as current planets deficiency is greater than best other match
        } else
        {
            return; // don't go anywhere as long as the optimal temperature has not been reached
        }
    }
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
TerraformerAPS.prototype.setSecondaryDestination = function(aps)
{
    //aps.secondaryDestination = false;
};
TerraformerAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
TerraformerAPS.prototype.evaluateMissionDestinations = function(aps)
{
    // aps.potDest = aps.potDest;
};
TerraformerAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS)
    {
        // toDo: how many terraformer can be employed at a planet?
        //if (conflictAPS.length > x) return true;
        return false;
    }
};
TerraformerAPS.prototype.confirmMission = function (aps)
{

};
TerraformerAPS.prototype.postActivationHook = function (aps)
{

};
TerraformerAPS.prototype.missionCompleted = function(aps)
{
    // terraformer does not use secondary destination.
    // Heating or cooling of a planet is the mission
    // Thus, mission is completed, if current destination does not need cooling or heating
    return this.getMissionStatus(aps, aps.destination) === 0;
};
TerraformerAPS.prototype.getNextSecondaryDestination = function(aps, ctP)
{
    return false;
};
TerraformerAPS.prototype.getNextPrimaryDestination = function(aps, ctP)
{
    return false;
};
/*
    INTERNAL METHODS
 */
TerraformerAPS.prototype.setSinks = function(aps)
{
    // as terraformer, each planet with a temperature other than the optimal is a sink
    // and the object of interest usually is nothing else than terraform
    // however, if it would be known that there are natives (bioscan) priority could be used for those planets
    // the same goes for planets where the resources are known
    // priority should be given to extreme planets (i.e. colder than 15° C and hotter than 84° C)
    this.setScopeRange(aps);
    let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    let pCs = [];
    let self = this;
    targetsInRange.forEach(function (pos) {
        let p = vgap.planetAt(pos.x, pos.y);
        let c = autopilot.getColony(p.id);
        c.deficiency = self.getTerraformDeficiency(aps, p);
        if (c.deficiency < 0) pCs.push(c);
    });
    console.log("...targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
    let emergencies = pCs.filter(function (c) {
        return c.planet.temp === 0;
    }); // extreme limiting conditions (crystalls = 0° planets))
    let withNatives = pCs.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    withNatives.sort(function (a, b) {
        return a.deficiency - b.deficiency;
    });
    //
    let potential = pCs.filter(function (c) {
        return c.planet.nativeclans === 0;
    });
    potential.sort(function (a, b) {
        return a.deficiency - b.deficiency;
    });
    //
    let amorph = pCs.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    console.log("... potential targets: " + potential.length);
    console.log("... amorph targets: " + amorph.length);
    console.log("... other native targets: " + withNatives.length);

    this.sinks = emergencies.concat(withNatives, potential);

    if (this.sinks.length < 1 && amorph.length > 0)
    {
        this.sinks = amorph;
    }
};
TerraformerAPS.prototype.getTerraformDeficiency = function(aps, p)
{
    if (typeof p === "undefined") p = aps.planet;
    console.log("TerraCooler: %s, TerraHeater: %s.", aps.terraCooler, aps.terraHeater);
    console.log("Planet temperature = %s.", p.temp);
    if (p.temp < 0) return 0; // exclude planets with unknown temperatures
    let pTemp = parseInt(p.temp);
    if (pTemp > 50 && aps.terraCooler && vgap.player.raceid !== 7)
    {
        return (50 - pTemp);
    } else if (pTemp < 50 && aps.terraHeater && vgap.player.raceid !== 7)
    {
        return (pTemp - 50);
    } else if (pTemp < 100 && vgap.player.raceid === 7 && aps.terraHeater)
    {
        if (p.nativeclans > 0 && p.nativeracename !== "Siliconoid")
        {
            return (pTemp - 80); // toDo: chosen arbitrarily
        } else
        {
            return (pTemp - 100);
        }
    }
    return 0;
};
TerraformerAPS.prototype.getMissionStatus = function(aps, p)
{
    return this.getTerraformDeficiency(aps, p);
};
TerraformerAPS.prototype.setScopeRange = function(aps)
{
    let inRange = aps.getAPSinRange(aps.scopeRange);
    if (inRange && inRange.length > 3)
    {
        aps.scopeRange *= 3;
    } else
    {
        aps.scopeRange *= 2;
    }
};
TerraformerAPS.prototype.setSources = function(aps)
{
    // sources are not necessary...
    this.sources = [];
    console.log(this.sources);
};
TerraformerAPS.prototype.isSource = function(planet)
{
    for (let i = 0; i < this.sources.length; i++)
    {
        if (this.sources[i].pid === planet.id) return true;
    }
    return false;
};
TerraformerAPS.prototype.loadCargo = function(aps)
{

};
TerraformerAPS.prototype.transferCargo = function(aps)
{

};
/*
 *
 * Auto Pilot Control
 *
 */
let autopilot = {
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
            shb: "Ships",
            fib: "Fighter",
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
            neu: "Fuel",
            name: "producing",
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
    /*
     *  BROWSER STORAGE
     */
    storage: {},                    // storage for the nuPilot (ship missions, base, etc.)
    storageId: false,               // storage ID for the previous
    settings: {},                   // storage for the nuPilot configuration (settings)
    storageCfgId: false,            // storage ID for the previous
    pStorage: {},                   // storage for planet assignments and build strategies
    pStorageId: false,              // storage ID for the previous
    /*
     *  DATA COLLECTIONS
     */
    colonies: {},
    globalMinerals: {},
    mineralMaxis: {},
    //
    towedShips: [],                 // IDs of towed (my)ships
    chunnelShips: [],               // IDs of ships that will be chunnel
    robbedShips: [],                // IDs of ships that have been robbed
    //
    hizzzerPlanets: [],             // populated by APS.setMissionAttributes
    //
    frnnPlanets: [],
    frnnOwnPlanets: [],
    frnnEnemyMinefields: [],
    frnnFriendlyWebMinefields: [],
    frnnEnemyWebMinefields: [],
    frnnFriendlyMinefields: [],
    frnnStarClusters: [],
    frnnEnemyShips: [],
    frnnEnemyPlanets: [],
    //
    isChromeBrowser: false,
    /*
     *  GENERAL GAME TASKS
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
                    let apsData = autopilot.isInStorage(msg.target);
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
        autopilot.initMyColonies();
        autopilot.updateMyColonies();
    },
    initMyColonies: function()
    {
        for (let i = 0; i < vgap.myplanets.length; i++)
        {
            const p = vgap.myplanets[i];
            autopilot.colonies[p.id] = new Colony(p.id, true); // initialize colony (no building)
            const c = autopilot.colonies[p.id];
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
        //console.log(autopilot.globalMinerals);
    },
    updateMyColonies: function()
    {
        for (let i = 0; i < vgap.myplanets.length; i++)
        {
            let p = vgap.myplanets[i];
            autopilot.updateColony(p.id);
        }
    },
    updateColony: function(id)
    {
        if (typeof autopilot.colonies[id] === "undefined") {
            autopilot.colonies[id] = new Colony(id, true); // initialize colony and build
        } else
        {
            autopilot.colonies[id].update();
        }
        // synchronize planeteer data
        let appData = autopilot.planetIsInStorage(id);
        autopilot.syncLocalPlaneteerStorage(appData);
    },
    getColony: function(id, initBalance)
    {
        if (typeof initBalance === "undefined") initBalance = false;
        autopilot.updateColony(id);
        if (initBalance) autopilot.colonies[id].initializeBalance();
        return autopilot.colonies[id];
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
        let nCols = ["ff3399", "6666ff", "ffc299", "66b3ff", "ff99ff", "6699ff", "7fffd4", "ee3b3b"];
        let disCol = "D3D3D3";
        let expCol = "FFFF00";
        let apsControl = [];
        for (let i = 0; i < vgap.myships.length; i++)
        {
            let ship = vgap.myships[i];
            //
            // set APS note color
            //
            let cfgData = autopilot.isInStorage(ship.id);
            if (cfgData) // if configuration is available in storage
            {
                let aps = new APS(ship, cfgData); // INITIAL PHASE
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
     *  APS Toolbox
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

        let ship = vgap.getShip(shipId);
        let aps = new APS(ship, cfgData); // INITIAL PHASE
        if (aps.isAPS)
        {
            aps.initAPScontrol();
            if (aps.hasToSetPotDes)
            {
                console.warn("=> SET POTENTIAL DESTINATIONS: APS " + aps.ship.id);
                autopilot.populateFrnnCollections();
                aps.functionModule.setPotentialDestinations(aps); // PHASE 1
                if (aps.potDest.length > 0) {
                    console.warn("SET MISSION DESTINSTION: APS " + aps.ship.id);
                    aps.setMissionDestination(); // PHASE 2
                }
                aps.updateNote();
            }
            if (!aps.isIdle)
            {
                console.warn("CONFIRM MISSION: APS " + aps.ship.id);
                aps.confirmMission(); // PHASE 3
                if (typeof aps.functionModule.postActivationHook === "function") aps.functionModule.postActivationHook(aps);
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
        /* let ship = vgap.getShip(shipId);
        autopilot.syncLocalStorage(cfgData);
        if (ship.note) ship.note.body += "(*)"; */
    },
    getAPSatPlanet: function(planet)
    {
        let apsAt = [];
        let shipsAt = vgap.shipsAt(planet.x, planet.y);
        for (let i = 0; i < shipsAt.length; i++)
        {
            let sData = autopilot.isInStorage(shipsAt[i].id);
            if (sData) apsAt.push(sData);
        }
        return apsAt;
    },
    getAPSwithDestination: function(p, secondary)
    {
        if (typeof secondary === "undefined") secondary = false;
        let apsWithDest = [];
        for (let i = 0; i < vgap.myships.length; i++)
        {
            let sData = autopilot.isInStorage(vgap.myships[i].id);
            if (sData)
            {
                if (!secondary && sData.destination === p.id) apsWithDest.push(sData);
                if (secondary && sData.secondaryDestination === p.id) apsWithDest.push(sData);
            }
        }
        return apsWithDest;
    },
    getIdleAPSfuelDeficiency: function(planet)
    {
        let fuelDef = 0;
        let apsAtPlanet = autopilot.getAPSatPlanet(planet);
        for (let i = 0; i < apsAtPlanet.length; i++)
        {
            if (apsAtPlanet[i].idle)
            {
                fuelDef += autopilot.getShipFuelDeficiency(apsAtPlanet[i].sid);
            }
        }
        if (fuelDef > 0) return fuelDef;
        return false;
    },
    /*
     *  LOCAL STORAGE HANDLING
     */
    setupStorage: function()
    {
        if (typeof(localStorage) === "undefined") {
            console.warn("Sorry! No Web Storage support..");
        }
        let isChromium = window.chrome,
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

        let createdBy = vgap.game.createdby;
        if (vgap.game.createdby === "none") createdBy = vgap.player.username;
        autopilot.oldStorageId = "nuPilot" + "default" + vgap.game.id;
        autopilot.storageId = "nuPilot" + createdBy + vgap.game.id;
        autopilot.storageCfgId = "nuPilotCfg" + createdBy + vgap.game.id;
        autopilot.pStorageId = "nuPlaneteer" + createdBy + vgap.game.id;
    },
    isInStorage: function(shipId)
    {
        let storedGameData = autopilot.loadGameData();
        if (storedGameData === null) // no storage setup yet
        {
            return false;
        } else
        {
            // storage available...
            for(let i = 0; i < storedGameData.length; i++)
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
        let storedGameData = autopilot.loadPlaneteerData();
        if (storedGameData === null) // no storage setup yet
        {
            return false;
        } else
        {
            // storage available...
            for(let i = 0; i < storedGameData.length; i++)
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
        let storedCfgData = JSON.parse(localStorage.getItem(autopilot.storageCfgId));
        if (typeof storedCfgData === "undefined" || storedCfgData === null) // no storage setup yet
        {
            let gdo = new APSSettings();
            let cfgData = gdo.getSettings();
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
            let update = new APSSettings(storedCfgData);
            autopilot.saveGameSettings(update.getSettings());
            autopilot.settings = update.getSettings();
            return update.getSettings();
        }
    },
    saveGameSettings: function(settings)
    {
        console.log("saveGameSettings");
        console.log(settings);
        let gData = new APSSettings(settings);
        console.log(gData);
        localStorage.setItem(autopilot.storageCfgId, JSON.stringify(gData.getSettings()));
        autopilot.settings = gData.getSettings();
    },
    loadGameData: function(data)
    {
        let storedGameData = JSON.parse(localStorage.getItem(autopilot.storageId));
        if (storedGameData === null) // no storage setup yet
        {
            // try old storageId
            storedGameData = JSON.parse(localStorage.getItem(autopilot.oldStorageId));
            if (storedGameData === null) // no storage setup yet
            {
                if (typeof data === "undefined") return false;
                let gdo = new APSdata(data);
                let gameData = gdo.getData();
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
        //console.log("saveGameData");
        //console.log(gameData);
        localStorage.setItem(autopilot.storageId, JSON.stringify(gameData));
    },
    behaviourHasToChange: function(current, future)
    {
        return (current.shipFunction !== future.shipFunction || current.ooiPriority !== future.ooiPriority);
    },
    deleteAPSdata: function(gameData, apsIndex)
    {
        if (apsIndex !== -1)
        {
            gameData.splice(apsIndex, 1); // delete stored data entry
        }
    },
    syncLocalStorage: function(data)
    {
        // load data
        let storedGameData = autopilot.loadGameData(data);
        if (!storedGameData) // error
        {
            console.error("Mandatory field empty!");
            return false;
        } else
        {
            // storage available...
            let sidList = storedGameData.map(function (cfg) {
                return cfg.sid;
            });
            let apsIndex = sidList.indexOf(data.sid);
            let requestedData = storedGameData[apsIndex];
            if (requestedData)
            {
                //console.info("upate APS storage data");
                // if turned off
                if (data.action === "END" || data.action === "DEL")
                {
                    autopilot.deleteAPSdata(storedGameData, apsIndex);
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
                    if (autopilot.behaviourHasToChange(requestedData, data) && data.destination)
                    {
                        // ship will finish current assignment (fly to destination) and then adapt to new setting
                        // set new function and new ooIPriority
                        requestedData.newFunction = data.shipFunction;
                        requestedData.newOoiPriority = data.ooiPriority;
                    } else if (autopilot.behaviourHasToChange(requestedData, data) && !data.destination)
                    {
                        // since no destination is set, we can change the behaviour immediately
                        requestedData.shipFunction = data.shipFunction;
                        requestedData.ooiPriority = data.ooiPriority;
                    }
                    // if the base has changed, update
                    if (data.base && requestedData.base !== data.base) requestedData.base = data.base;
                    // if idle status has changed, update
                    if (requestedData.idle !== data.idle) requestedData.idle = data.idle;
                    // if idle reason has changed, update
                    if (requestedData.idleReason !== data.idleReason) requestedData.idleReason = data.idleReason;
                    // if idle reason has changed, update
                    if (requestedData.idleTurns !== data.idleTurns) requestedData.idleTurns = data.idleTurns;
                    // if destination is provided, update/set
                    if (requestedData.destination !== data.destination) requestedData.destination = data.destination;
                    if (requestedData.secondaryDestination !== data.secondaryDestination) requestedData.secondaryDestination = data.secondaryDestination;
                    if (requestedData.lastDestination !== data.lastDestination) requestedData.lastDestination = data.lastDestination;
                    if (requestedData.currentOoi !== data.currentOoi) requestedData.currentOoi = data.currentOoi;
                    let gdo = new APSdata(requestedData);
                    storedGameData[apsIndex] = gdo.getData(); // synchronize stored data
                }
                autopilot.saveGameData(storedGameData);
                return storedGameData[apsIndex];
            } else
            {
                console.info("new APS storage data");
                // no stored data for this APS available
                let gdo = new APSdata(data);
                storedGameData.push(gdo.getData());
                autopilot.saveGameData(storedGameData);
                return gdo.getData();
            }
        }
    },
    loadPlaneteerData: function(data)
    {
        let storedPlaneteerData = JSON.parse(localStorage.getItem(autopilot.pStorageId));
        if (storedPlaneteerData === null) // no storage setup yet, setup
        {
            if (typeof data === "undefined") return false;
            let pd = new APPdata(data);
            let gameData = pd.getData();
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
        let storedPlaneteerData = autopilot.loadPlaneteerData(data);
        if (!storedPlaneteerData) // error
        {
            console.error("Mandatory field empty!");
            return false;
        } else
        {
            // storage available...
            for(let i = 0; i < storedPlaneteerData.length; i++)
            {
                // ...look for entry of planet
                if (storedPlaneteerData[i].pid === data.pid)
                {
                    // TURN-OFF routines
                    //
                    // taxation off
                    if (data.taxation === "off" && storedPlaneteerData[i].taxation !== "off")
                    {
                        let p = vgap.getPlanet(data.pid);
                        p.colonisttaxrate = 0;
                        p.nativetaxrate = 0;
                    }
                    //
                    let syncedData = new APPdata(data); // synchronize stored data
                    storedPlaneteerData[i] = syncedData.getData();
                    autopilot.savePlaneteerData(storedPlaneteerData);
                    return storedPlaneteerData[i];
                }
            }
            // if planet is not stored yet, add to storage
            //console.log(storedPlaneteerData);
            //console.log(data);
            let p = new APPdata(data);
            let pData = p.getData();
            storedPlaneteerData.push(pData);
            autopilot.savePlaneteerData(storedPlaneteerData);
            return pData;
        }
    },
    /*
     *  DATA COLLECTIONS
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
        autopilot.frnnEnemyWebMinefields = [];
        autopilot.frnnFriendlyWebMinefields = [];
        autopilot.frnnFriendlyMinefields = [];
        vgap.minefields.forEach(function(minefield) {
            if (minefield.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(minefield.ownerid))
            {
                if (minefield.isweb)
                {
                    autopilot.frnnEnemyWebMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                } else {
                    autopilot.frnnEnemyMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                }
            } else {
                if (minefield.isweb)
                {
                    autopilot.frnnFriendlyWebMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                } else {
                    autopilot.frnnFriendlyMinefields.push( { id: minefield.id, x: minefield.x, y: minefield.y, radius: minefield.radius, owner: minefield.ownerid } );
                }
            }
        });
    },
    populateFrnnShips: function()
    {
        autopilot.frnnEnemyShips = [];
        vgap.ships.forEach(function(ship) {
            // toDo: consider heading
            if (ship.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(ship.ownerid))
            {
                let isArmed = false;
                let shipHull = vgap.getHull(ship.hullid);
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
        autopilot.frnnEnemyPlanets = vgap.planets.filter(function (p) {
            p.pid = p.id; // toDo: transition to planet object collections
            return p.ownerid > 0 && p.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(p.ownerid);
        });
        autopilot.frnnUnownedPlanets = vgap.planets.filter(function (p) {
            p.pid = p.id; // toDo: transition to planet object collections
            return p.ownerid === 0;
        });
        autopilot.frnnOwnPlanets = vgap.planets.filter(function (p) {
            p.pid = p.id; // toDo: transition to planet object collections
            //console.log("Planet %s is owned by player %s. Player Id = %s", p.id, p.ownerid, vgap.player.id);
            return p.ownerid === vgap.player.id;
        });
        autopilot.frnnPlanets = vgap.planets;
    },
    populateShipCollections: function()
    {
        for (let i = 0; i < vgap.myships.length; i++) {
            let ship = vgap.myships[i];
            if (ship.mission === 6 && autopilot.towedShips.indexOf(ship.mission1target) === -1) autopilot.towedShips.push(ship.mission1target);
            if (ship.hullid === 56 && ship.warp === 0) // Firecloud at warp 0
            {
                if (ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 49) // initiating a chunnel ?
                {
                    // check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                    let receiver = vgap.getShip(ship.friendlycode);
                    if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== ship.x || receiver.y !== ship.y)) {
                        autopilot.updateChunnelTraffic(ship);
                    } else {
                        ship.friendlycode = "00c";
                    }
                } else {
                    let inList = autopilot.chunnelShips.indexOf(ship.id);
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
        let ships = vgap.shipsAt(ship.x, ship.y);
        if (ships)
        {
            for( let i = 0; i < ships.length; i++)
            {
                if ((ships[i].targetx === ships[i].x && ships[i].targety === ships[i].y) || ships[i].warp === 0)
                {
                    if (autopilot.chunnelShips.indexOf(ships[i].id) === -1) autopilot.chunnelShips.push(ships[i].id); // add ship to chunnel-ship-list
                }
            }
        }
    },
    /*
     *  INDICATORS
     */
    apsIndicators: function()
    {
        if (autopilot.settings.shipGFX || autopilot.settings.planetGFX)
        {
            for (let i = 0; i < vgap.myships.length; i++)
            {
                let markup = {
                    attr : {
                        stroke : autopilot.idColors[autopilot.objectTypeEnum.SHIPS],
                        lineWidth: 2,
                        lineCap: "round",
                        lineDash: [5,5]
                    }
                };
                let ship = vgap.myships[i];
                let cfgData = autopilot.isInStorage(ship.id);
                if (cfgData)
                {
                    if (autopilot.settings.shipGFX) autopilot.drawScaledCircle(ship.x, ship.y, 5, markup.attr, null, 0.5); // general APS indicator circle
                    let bP = vgap.getPlanet(cfgData.base);
                    if (bP && autopilot.settings.planetGFX) autopilot.drawScaledQuarterCircle(bP.x, bP.y, 6, "nw", markup.attr, null, 0.5); // APS BASE indicator
                }
            }
        }
    },
    shipRGAIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            let markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.RGA],
                    lineWidth: 3,
                    lineCap: "round",
                    lineDash: [5, 20]
                }
            };
            if (vgap.player.id === 10 && ship.mission === 8) // Rebel Ground Attack
            {
                let maxDash = markup.attr.lineDash[1];
                for (let i = 0; i < maxDash; i++) {
                    markup.attr.lineDash = [markup.attr.lineDash[0], markup.attr.lineDash[0] + i];
                    autopilot.drawScaledQuarterCircle(ship.targetx, ship.targety, 10 - (i * 0.5), "sw", markup.attr, null, 0.5);
                    /*for (let j = 0; j < (maxDash * 5); j++)
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
            let markup = {
                attr: {
                    stroke: autopilot.idColors[autopilot.objectTypeEnum.CLOAK],
                    lineWidth: 3,
                    lineCap: "round",
                    lineDash: [5, 5]
                }
            };
            let hull = vgap.getHull(ship.hullid);
            if (ship.iscloaked || (hull && hull.cancloak && ship.mission === 9)) {
                let alpha = 0.5;
                if (ship.iscloaked) alpha = 0.9;
                autopilot.drawScaledQuarterCircle(ship.x, ship.y, 10, "sw", markup.attr, null, alpha);
            }
        }
    },
    shipRobbedIndicator: function(ship)
    {
        if (autopilot.settings.shipGFX) {
            let markup = {
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
            let markup = {
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
                let isReceiver = false;
                let isInitiator = false;
                if (ship.warp === 0 && ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 49) // initiating a chunnel?
                {
                    // check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                    let receiver = vgap.getShip(ship.friendlycode);
                    if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== ship.x || receiver.y !== ship.y)) {
                        autopilot.updateChunnelTraffic(ship);
                        isInitiator = true;
                    } else {
                        ship.friendlycode = "00c";
                    }
                } else if (ship.warp === 0 && !ship.friendlycode.match(/\d\d\d/) && ship.neutronium > 0) // receiving a chunnel?
                {
                    let padId = String(ship.id);
                    if (ship.id < 100) {
                        if (ship.id < 10) {
                            padId = "00" + ship.id;
                        } else {
                            padId = "0" + ship.id;
                        }
                    }
                    for (let i = 0; i < vgap.myships.length; i++) {
                        let curCS = vgap.myships[i];
                        if (curCS.hullid === 56 && curCS.warp === 0 && curCS.friendlycode === padId) {
                            autopilot.chunnelShips.push(ship.id);
                            isReceiver = true;
                        }
                    }
                }
                if (!isReceiver && !isInitiator) {
                    let inList = autopilot.chunnelShips.indexOf(ship.id);
                    if (inList > -1) {
                        autopilot.chunnelShips.splice(inList, 1);
                        if (ship.friendlycode.match(/\d\d\d/)) ship.friendlycode = "00c";
                    }
                }
            }
            if ((ship.warp === 0 || !autopilot.shipTargetIsSet(ship) || autopilot.shipIsWellBouncing(ship)) && autopilot.towedShips.indexOf(ship.id) === -1 && autopilot.chunnelShips.indexOf(ship.id) === -1) {
                let cfgData = autopilot.isInStorage(ship.id);
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
     *  General Toolbox
     */
    getDistance: function(p1, p2, exact)
    {
        if (typeof exact === "undefined") exact = true;
        let destIsPlanet = vgap.planetAt(p2.x, p2.y);
        let dist = Math.sqrt((Math.pow((parseInt(p1.x) - parseInt(p2.x)),2) + Math.pow((parseInt(p1.y) - parseInt(p2.y)),2)));
        if (!exact && destIsPlanet && dist >= 2.2) dist -= 2.2;
        return dist;
    },
    getTargetsInRange: function(coords, x, y, r)
    {
        let frnn = new FRNN(coords, r);
        return frnn.inRange( { x: x, y: y }, r);
    },
    sortCollection: function(collection, order, direction)
    {
        // default sorting - from low to high (ascending)
        if (typeof direction === "undefined") direction = "asc";
        if (typeof order === "undefined") order = "distance";
        let returnIfSmaller = -1;
        let returnIfBigger = 1;
        if (direction === "desc")
        {
            // sorting from high to low
            returnIfSmaller = 1;
            returnIfBigger = -1;
        }
        return collection.sort(
            function(a, b)
            {
                let x = a[order];
                let y = b[order];
                if (x < y) {return returnIfSmaller;}
                if (x > y) {return returnIfBigger;}
                return 0;
            }
        );
    },
    isFriendlyPlayer: function(playerId)
    {
        for (let i = 0; i < vgap.relations.length; i++)
        {
            if (vgap.relations[i].playertoid === playerId)
            {
                return (vgap.relations[i].relationto >= 2);
            }
        }
    },
    objectIsInside: function(object, inside)
    {
        if (typeof object === "undefined" || typeof inside === "undefined") return false;
        let hits = inside.filter(function (item) {
            let curDistToItemCenter = Math.floor(autopilot.getDistance({x: item.x, y: item.y}, {x: object.x, y: object.y}));
            return item.radius > curDistToItemCenter;
        });
        return hits.length > 0;
    },
    getAboveKpercentileMean: function(values, k)
    {
        let thresh = autopilot.getKpercentileThresh(values, k);
        let threshAndAboveValues = values.filter(function (val) {
            return val >= thresh;
        });
        if (threshAndAboveValues.length > 0)
        {
            let sum = threshAndAboveValues.reduce(function(total, val) {
                return total + val;
            });
            return Math.round(sum / threshAndAboveValues.length);
        }
        return 0;
    },
    getKpercentileThresh: function(values, k)
    {
        if (k > 100) k = 100;
        if (k < 1) k = 1;
        values.sort(function (a, b) {
            return a - b;
        });
        let index = (k / 100) * values.length;
        let roundedIndex = Math.ceil(index);
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
    getIonStormClass: function(iStorm)
    {
    let futureVoltage = iStorm.voltage;
    if (iStorm.isgrowing) futureVoltage = Math.floor(futureVoltage * 1.2);
    if (futureVoltage < 50) { return "harmless"; }
    else if (futureVoltage >= 50 && futureVoltage < 100) { return "moderate"; }
    else if (futureVoltage >= 100 && futureVoltage < 150) { return "strong"; }
    else if (futureVoltage >= 150 && futureVoltage < 200) { return "dangerous"; }
    else if (futureVoltage >= 200) { return "very dangerous"; }
    return false;
},
    objectInside: function(object, inside)
    {
        if (typeof object === "undefined" || typeof inside === "undefined") return false;
        let hits = [];
        for (let i = 0; i < inside.length; i++)
        {
            let curDistToMinefieldCenter = Math.floor(autopilot.getDistance({x: inside[i].x, y: inside[i].y}, {x: object.x, y: object.y}));
            if (inside[i].radius > curDistToMinefieldCenter) hits.push(inside[i]);
        }
        return hits;
    },
    getObjectsInRangeOf: function(objects, range, of)
    {
        let objectsInRange = [];
        for (let j = 0; j < objects.length; j++)
        {
            let dist = Math.floor(autopilot.getDistance({x: objects[j].x, y: objects[j].y}, {x: of.x, y: of.y}));
            if (dist <= range) objectsInRange.push(objects[j]);
        }
        return objectsInRange;
    },
    objectCloseTo: function(object, closeTo)
    {
        // toDo: replace objectInsideMinefield/Ionstorm (non-strict)
        // toDo: check heading of storm and consider heading of ship => // toDo: consider distance next turn
    },
    objectInsideEnemyMineField: function(object)
    {
        return autopilot.objectInside(object, autopilot.frnnEnemyMinefields);
    },
    objectInsideEnemyWebMineField: function(object)
    {
        return autopilot.objectInside(object, autopilot.frnnEnemyWebMinefields);
    },
    objectInsideOwnMineField: function(object) // own = friendly
    {
        return (autopilot.objectInside(object, autopilot.frnnFriendlyMinefields) || autopilot.objectInside(object, autopilot.frnnFriendlyWebMinefields));
    },
    objectInsideStarCluster: function(object)
    {
        if (typeof object === "undefined") return false;
        let sc = vgap.stars;
        let inside = [];
        for (let i = 0; i < sc.length; i++)
        {
            let curDistToStarClusterCenter = autopilot.getDistance({x: sc[i].x, y: sc[i].y}, {x: object.x, y: object.y});
            let radiationradius = Math.sqrt(sc[i].mass);
            if (radiationradius > curDistToStarClusterCenter)
            {
                console.log("...object (" + object.name + ") inside radiation zone of starcluster.");
                inside.push(sc[i]);
            }
        }
        return inside;
    },
    objectInsideIonStorm: function(object, strict)
    {
        if (typeof object === "undefined") return false;
        if (typeof strict === "undefined") strict = true;
        let ionStorms = vgap.ionstorms;
        let inside = [];
        for (let i = 0; i < ionStorms.length; i++)
        {
            let curDistToIonStormCenter = Math.floor(autopilot.getDistance({x: ionStorms[i].x, y: ionStorms[i].y}, {x: object.x, y: object.y}));
            if (strict) // only true if object is INSIDE ionstorm
            {
                if (ionStorms[i].radius > curDistToIonStormCenter) inside.push(ionStorms[i]);
            } else // non-strict, also true if we are too close to the ionstorm
            {
                if (ionStorms[i].radius > curDistToIonStormCenter || (curDistToIonStormCenter - ionStorms[i].radius) < Math.pow(ionStorms[i].warp,2)) inside.push(ionStorms[i]);
            }
        }
        return inside;
    },
    /*
     *  StarShip Toolbox
     */
    getHullCargoMass: function(sid, scargo)
    {
        let beamTecMass = [0,1,1,2,4,3,4,7,5,7,6];
        let torpTecMass = [0,2,2,2,4,2,2,3,2,3,3];
        let ship = vgap.getShip(sid);
        let hull = vgap.getHull(ship.hullid);
        let hullCargoMass = hull.mass;
        let maxHullCargoMass = hull.mass + hull.cargo;
        if (typeof scargo !== "undefined" && scargo.length > 0)
        {
            scargo.push(ship.beams * beamTecMass[ship.beamid]);
            scargo.push(ship.torps * torpTecMass[ship.torpedoid]);
            scargo.push(ship.ammo);
            scargo.forEach(function(comp) { hullCargoMass += parseInt(comp); });
            if (hullCargoMass > maxHullCargoMass) hullCargoMass = maxHullCargoMass;
        } else
        {
            let components = [
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
        let ship = vgap.getShip(sid);
        if (typeof distance === "undefined") distance = Math.ceil(autopilot.getDistance( { x: ship.x, y: ship.y }, { x: ship.targetx, y: ship.targety } ));
        if (typeof cargo === "undefined") cargo = [];
        let hullCargoMass = autopilot.getHullCargoMass(sid, cargo); // without fueltank content, if cargo is an emty array, current ship cargo is used
        //console.log("HullCargoMass = " + hullCargoMass);
        let warp = ship.engineid;
        let hull = vgap.getHull(ship.hullid);
        let maxTurnDist = Math.pow(warp, 2);
        let travelTurns = Math.ceil(distance / maxTurnDist);
        let fFactor = autopilot.fuelFactor["t" + ship.engineid][warp]; // currently applicable fuel factor
        let penalty = 0;
        if (hull.cancloak) // toDo: && ship.mission === 9 && !hull.special.match(/advanced Cloak/)
        {
            let minPenalty = 5;
            let massPenalty = Math.ceil(hull.mass / 20);
            if (massPenalty > minPenalty)
            {
                penalty += massPenalty;
            } else
            {
                penalty += minPenalty;
            }
            penalty *= travelTurns;
        } // toDo: other additional fuel requirenment
        let basicConsumption = vgap.turnFuel(distance, hullCargoMass, fFactor, maxTurnDist, penalty);
        //
        let actualConsumption = vgap.turnFuel(distance, hullCargoMass + basicConsumption, fFactor, maxTurnDist, penalty);
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
    clearShipNote: function(shipId) // called when APS is deactivated
    {
        let note = vgap.getNote(shipId, 2);
        if (note)
        {
            note.body = "";
        }
    },
    clearShipTarget: function(shipId) // called when APS is deactivated
    {
        let ship = vgap.getShip(shipId);
        ship.targetx = ship.x;
        ship.targety = ship.y;
    },
    shipIsWellBouncing: function(ship)
    {
        // ship in orbit && warp speed > 1 && target == warp well
        let atPlanet = vgap.planetAt(ship.x, ship.y);
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
    getNonAPSatPlanet: function(planet)
    {
        let nonAPS = [];
        let shipsAt = vgap.shipsAt(planet.x, planet.y);
        //console.log("...found " + shipsAt.length + " ships at planet...");
        for (let i = 0; i < shipsAt.length; i++)
        {
            let sData = autopilot.isInStorage(shipsAt[i].id);
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
    getShipFuelDeficiency: function(sid, cargo, distance)
    {
        if (typeof cargo === "undefined") cargo = [];
        let fuelDef = 0;
        let ship = vgap.getShip(sid);
        let required = autopilot.getOptimalFuelConsumptionEstimate(sid, cargo, distance);
        if (required > ship.neutronium)
        {
            fuelDef = required - ship.neutronium;
            //console.log("...ship (" + ship.id + ") with fuel deficiency (" + fuelDef + ") at planet.");
        }
        return fuelDef;
    },
    getNonAPSfuelDeficiency: function(planet)
    {
        let fuelDef = 0;
        let closestPlanet = autopilot.getClosestPlanet( { x: planet.x, y: planet.y } );
        let distance = Math.ceil(autopilot.getDistance( { x: planet.x, y: planet.y }, { x: closestPlanet.x ,y: closestPlanet.y } ));
        let atPlanet = autopilot.getNonAPSatPlanet(planet);
        for (let i = 0; i < atPlanet.length; i++)
        {
            //console.log("...check ship (" + atPlanet[i] + ") for fuel deficiency...");
            fuelDef += autopilot.getShipFuelDeficiency(atPlanet[i], [], distance);
        }
        if (fuelDef > 0) return fuelDef;
        return false;
    },
    positionIsInWarpWellOfPlanet: function(planet, position)
    {
        if (typeof planet === "undefined" || typeof position === "undefined") return false;
        let distance = Math.ceil(autopilot.getDistance( {x: position.x, y: position.y}, {x: planet.x, y: planet.y} ));
        return (distance <= 3);
    },
    getCurCargoCapacity: function(s)
    {
        const hull = vgap.getHull(s.hullid);
        let cargoCapacity = hull.cargo;
        const components = [
            s.duranium,
            s.tritanium,
            s.molybdenum,
            s.supplies,
            s.ammo, // torpedos or fighters
            s.clans
        ];
        components.forEach(function(comp) { cargoCapacity -= parseInt(comp); });
        return cargoCapacity;
    },
    /*
     *  Planet Toolbox
     */
    enemyShipAtPlanet: function(p, playerid) // toDo: => Colony
    {
        let ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0)
        {
            for (let i = 0; i < ships.length; i++)
            {
                if (ships[i].ownerid === vgap.player.id) continue;
                if (!autopilot.isFriendlyPlayer(ships[i].ownerid)) return true;
            }
        }
        return false;
    },
    getDamagedShips: function(p)
    {
        let ships = vgap.shipsAt(p.x, p.y);
        let damaged = [];
        if (ships.length > 0)
        {
            ships.forEach(function (s) {
                if (s.ownerid === vgap.player.id && s.damage > 0) damaged.push(s);
            });
        }
        return damaged;
    },
    getLFMships: function(p)
    {
        let lfm = [];
        if (vgap.player.raceid === 9 || vgap.player.raceid === 10 || vgap.player.raceid === 11)
        {
            let ships = vgap.shipsAt(p.x, p.y);
            if (ships.length > 0)
            {
                ships.forEach(function (s) {
                    if (s.ownerid === vgap.player.id && s.friendlycode.toLowerCase() === "lfm") lfm.push(s);
                });
            }
        }
        return lfm;
    },
    refineryAtPlanet: function(planet) // toDo: => Colony
    {
        return autopilot.specialShipAtPlanet(planet, 104);
    },
    alchemyAtPlanet: function(planet) // toDo: => Colony
    {
        return autopilot.specialShipAtPlanet(planet, 105);
    },
    specialShipAtPlanet: function(planet, hullid) // toDo: => Colony
    {
        let ships = vgap.shipsAt(planet.x, planet.y);
        if (ships.length > 0)
        {
            for (let i = 0; i < ships.length; i++)
            {
                if (ships[i].hullid === hullid && ships[i].friendlycode !== "nal") return true;
            }
        }
        return false;
    },
    // Get SUM OF OBJECT(S) WITHIN a CERTAIN RANGE
    isMineral: function(object)
    {
        return (object === "neutronium" || object === "duranium" || object === "tritanium" || object === "molybdenum");
    },
    getSumOfObjectInRange: function(center, range, object, includePotential)
    {
        if (typeof includePotential === "undefined") includePotential = false;
        let planetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, center.x, center.y, range);
        let coloniesInRange = planetsInRange.map(function (p) {
            return autopilot.getColony(p.id, true);
        });
        let amounts = coloniesInRange.map(function (c) {
            if (autopilot.isMineral(object) && includePotential)
            {
                return c.balance[object] + c.planet["ground" + object];
            } else
            {
                return c.balance[object];
            }
        });
        console.log("amounts", amounts);
        let total = amounts.reduce(function (total, amount) {
            return total + amount;
        }); 
        console.log("total", total);
        return total; 
    },
    getSumOfAvailableObjectInRange: function(center, range, object, includePotential)
    {
        if (typeof includePotential === "undefined") includePotential = false;
        let planetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, center.x, center.y, range);
        let coloniesInRange = planetsInRange.map(function (p) {
            return autopilot.getColony(p.id);
        });
        let regularColonies = coloniesInRange.filter(function (c) {
            return !c.isBuildingBase && (!c.hasStarbase || c.hasStarbase && c.isFort);
        });
        let amounts = regularColonies.map(function (c) {
            c.initializeBalance();
            if (autopilot.isMineral(object) && includePotential)
            {
                return c.balance[object] + c.planet["ground" + object];
            } else
            {
                return c.balance[object];
            }
        });
        //console.log("amounts", amounts);
        return amounts.reduce(function (total, amount) {
            return total + amount;
        });
    },
    getSumOfObjectsInRange: function(center, range)
    {
        let planets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, center.x, center.y, range);
        let objects = {
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
        for (let i = 0; i < planets.length; i++)
        {
            let cP = vgap.getPlanet(planets[i].pid);
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
    /*
        getClosestPlanet: looks within a certain range (200lj) around coordinates for planets, sorts them by distance and returns candidate.
            coordinates { x: a.x, y: a.y }
            candidate to return (array position)
     */
    getClosestPlanet: function(coords, candidate, all)
    {
        if (typeof coords === "undefined") return false;
        if (typeof all === "undefined") all = false;
        let planets = [];
        //console.log({ x: coords.x, y: coords.y});
        //console.log(autopilot.frnnOwnPlanets);
        let closestPlanets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 200);
        if (all) closestPlanets = autopilot.getTargetsInRange(autopilot.frnnPlanets, coords.x, coords.y, 200);
        for (let i = 0; i < closestPlanets.length; i++)
        {
            let cP = vgap.getPlanet(closestPlanets[i].pid);
            if (cP)
            {
                let distance = Math.ceil(autopilot.getDistance( {x: cP.x, y: cP.y}, {x: coords.x ,y: coords.y} ));
                let dataEntry = { planet: cP, distance: distance };
                planets.push(dataEntry);
            }
        }
        //console.log("...found " + planets.length + " close planets.");
        if (planets.length > 1)
        {
            let sorted = autopilot.sortCollection(planets, "distance", "asc");
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
     * DRAWING
     */
    // draw: executed on any click or drag on the starmap
    draw: function() {
        //console.log("Draw: plugin called.");
        autopilot.towedShips = [];
        for (let i = 0; i < vgap.myships.length; i++)
        {
            let s = vgap.myships[i];
            if (s.mission === 6 && autopilot.towedShips.indexOf(s.mission1target) === -1) autopilot.towedShips.push(s.mission1target);
        }
        for (let i = 0; i < vgap.myships.length; i++)
        {
            let s = vgap.myships[i];
            autopilot.shipIdleIndicator(s);
            autopilot.shipCloakIndicator(s);
            autopilot.shipRobbedIndicator(s);
            autopilot.shipRGAIndicator(s);
        }
        for (let i = 0; i < vgap.myplanets.length; i++)
        {
            let p = vgap.myplanets[i];
            autopilot.getColony(p.id).drawIndicators();
        }
        autopilot.apsIndicators();
    },
    //
    drawSolidCircle : function(x, y, radius, attr, paperset, alpha) {
        if (!vgap.map.isVisible(x, y, radius))
            return;
        radius *= vgap.map.zoom;
        if (radius <= 1)
            radius = 1;
        if (paperset === null)
            paperset = vgap.map.ctx;
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.fillColor, alpha);
        paperset.beginPath();
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * 1.15, Math.PI * 1.15, false);
        paperset.lineTo(vgap.map.screenX(x), vgap.map.screenY(y));
        paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius, Math.PI * 1.15, Math.PI * 1.35, false);
        paperset.lineTo(vgap.map.screenX(x), vgap.map.screenY(y));
        paperset.closePath();
        paperset.stroke();
        let org_fill_style = paperset.fillStyle;
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
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        let org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        let org_dash_style = paperset.getLineDash();
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
    drawVerticalLine : function(x, y, distance, zone, attr, paperset, alpha, partial, height) {
        if (distance <= 1) distance = 5;
        distance *= vgap.map.zoom;
        let zones = {
            ne: [distance, 0],
            se: [distance, -20],
            sw: [distance*-1, -20],
            nw: [distance*-1, 0]
        };
        let startX = vgap.map.screenX(x) + parseInt(zones[zone][0]);
        let startY = vgap.map.screenY(y) + parseInt(zones[zone][1]);
        //if (!vgap.map.isVisible(x, y, distance)) return;
        if (typeof partial === "undefined") partial = 1;
        height *= vgap.map.zoom;
        if (partial < 1) height = height * partial;
        //
        if (paperset === null)
            paperset = vgap.map.ctx;
        //
        //  save original attributes
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        let org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        let org_dash_style = paperset.getLineDash();
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
    drawHorizontalLine : function(x, y, yDist, zone, attr, paperset, alpha, partial, width) {
        if (yDist <= 1) yDist = 1;
        yDist *= vgap.map.zoom;
        width *= vgap.map.zoom;
        let xBaseDist = 5*vgap.map.zoom;
        let zones = {
            ne: [xBaseDist, yDist*-1],
            se: [xBaseDist, yDist],
            sw: [(width+xBaseDist)*-1, yDist],
            nw: [(width+xBaseDist)*-1, yDist*-1]
        };
        let startX = vgap.map.screenX(x) + parseInt(zones[zone][0]);
        let startY = vgap.map.screenY(y) + parseInt(zones[zone][1]);
        //if (!vgap.map.isVisible(x, y, distance)) return;
        if (typeof partial === "undefined") partial = 1;

        if (partial < 1) width = width * partial;
        //
        if (paperset === null)
            paperset = vgap.map.ctx;
        //
        //  save original attributes
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        let org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        let org_dash_style = paperset.getLineDash();
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
        let zones = {
            ne: [1.5,2],
            se: [0,0.5],
            sw: [0.5,1],
            nw: [1,1.5]
        };
        if (partial < 1)
        {
            let newStartAngle = zones[zone][0] + (partial * 0.25); // increase start-angle
            let newEndAngle = zones[zone][1] - (partial * 0.25); // reduce end-angle
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
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        let org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        let org_dash_style = paperset.getLineDash();
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
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = 1;
        //
        for (let i = 0; i <= attr.lineWidth; i++)
        {
            paperset.beginPath();
            paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius + i, 0, Math.PI * 2, false);
            paperset.stroke();
        }

        if (attr.outline)
        {
            paperset.beginPath();
            paperset.arc(vgap.map.screenX(x), vgap.map.screenY(y), radius + attr.lineWidth, 0, Math.PI * 2, false);
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
        let zones = {
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
        let org_stroke_style = paperset.strokeStyle;
        paperset.strokeStyle = colorToRGBA(attr.stroke, alpha);
        //save original line width
        let org_line_width = paperset.lineWidth;
        paperset.lineWidth = attr.lineWidth;
        let org_line_cap = paperset.lineCap;
        paperset.lineCap = attr.lineCap;
        let org_dash_style = paperset.getLineDash();
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
     *  UI - Hooks
     */
    // processload: executed whenever a turn is loaded: either the current turn or an older turn through time machine
    processload: function(rst) {
        console.log(vgap);
        console.log(rst);
        // autopilot.scanReports();
        autopilot.setupStorage(); // local storage setup
        // Settings
        autopilot.loadGameSettings();
        //
        console.log("Settings Turn = %s - Game Turn %s", vgap.settings.turn, vgap.game.turn);
        if (!vgap.inHistory) // only act, when we are in the present
        {
            autopilot.scanReports(); // check reports for destroyed vessels
            autopilot.populateFrnnCollections();
            autopilot.populateShipCollections();
            //
            autopilot.planetaryManagement(); // myplanets -> colony -> set build targets according to planet mineral values, build structures, set taxes, set resource balance (deficiency / request & excess)
            //autopilot.populateMineralMaxis(); // now included in planetaryManagement
            //
            // APSs initial setup
            let apsControl = autopilot.initializeAPScontrol(); // INITIAL PHASE
            //
            // APS that arrived at destination did unload their cargo...
            //
            //
            //autopilot.planetaryManagement(); // e.g. update buildTargets & build ??
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
                    shipcontrol.setMissionDestination(); // PHASE 2
                    shipcontrol.initAPScontrol(); // reload apsBy... collections
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
                            console.warn("SET MISSION DESTINATION: APS " + shipcontrol.ship.id);
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
    // loaddashboard: executed to rebuild the dashboard content after a turn is loaded
    loaddashboard: function() {
        console.log("LoadDashboard: plugin called.");
        let a = $("<ul></ul>").appendTo("#DashboardMenu");
        vgap.dash.addLeftMenuItem("nuPilot" + " »", function() {
            vgap.dash.showNuPilotDash();
        }, a);
    },
    // showdashboard: executed when switching from starmap to dashboard
    showdashboard: function() {
        //console.log("ShowDashboard: plugin called.");
    },
    // showsummary: executed when returning to the main screen of the dashboard
    showsummary: function() {
        //console.log("ShowSummary: plugin called.");
    },
    // loadmap: executed after the first turn has been loaded to create the map
    loadmap: function() {
        //console.log("LoadMap: plugin called.");
    },
    // showmap: executed when switching from dashboard to starmap
    showmap: function() {
        console.log("ShowMap: plugin called.");

    },
    // loadplanet: executed when a planet is selected on dashboard or starmap
    loadplanet: function() {
        console.log("LoadPlanet: plugin called.");
        let c = autopilot.getColony(vgap.planetScreen.planet.id, true);
        console.log(c);
    },
    // loadstarbase: executed when a starbase is selected on dashboard or starmap
    loadstarbase: function() {
        //console.log("LoadStarbase: plugin called.");
        //console.log("Starbase id: " + vgap.starbaseScreen.starbase.id + " on planet id: " + vgap.starbaseScreen.planet.id);
    },
    // loadship: executed when a planet is selected on dashboard or starmap
    loadship: function() {
        console.log("LoadShip: plugin called.");
        let apsData = autopilot.isInStorage(vgap.shipScreen.ship.id);
        if (apsData)
        {
            if (apsData.idle)
            {
                console.log("Ship idle status: " + apsData.idle);
                autopilot.setupAPS(vgap.shipScreen.ship.id, apsData);
            }
        }
        console.log(vgap.shipScreen.ship);
    }
};/*
 *  Planet Object toDo: organize all planet related info here
 */
function Colony(pid, build, draw)
{
    if (typeof build === "undefined") build = false;
    if (typeof draw === "undefined") draw = false;

    this.abrMoveables = {
        neu: "neutronium",
        dur: "duranium",
        tri: "tritanium",
        mol: "molybdenum",
        cla: "clans",
        sup: "supplies",
        mcs: "megacredits"
    };
    this.minerals = ["neutronium","duranium","tritanium","molybdenum"];
    this.resources = this.minerals.concat(["clans","megacredits","supplies"]);
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
    //
    this.pid = pid;
    this.planet = vgap.getPlanet(pid);
    if (!autopilot.planetIsInStorage(pid)) autopilot.syncLocalPlaneteerStorage({ pid: pid }); // make sure we have a default entry for the colony
    this.owner = this.getPlanetOwner();
    this.hasStarbase = vgap.getStarbase(pid);
    this.isOwnPlanet = (this.planet && this.planet.ownerid === vgap.player.id); // only own planets are colonies
    this.isBuildingBase = this.isBuildingStarbase();
    this.isFort = this.isFortifying(); // a purely defensive base
    this.isSellingSupply = this.getSellingSupply();
    this.isBuildingStructures = this.getBuildingStructures();
    this.hasTecRace = this.nativesAreTecRace();
    this.mineralProduction = this.getMineralProduction();
    this.taxation = false;
    //  APS Helper Attributes
    this.sourceType = [];
    this.isFuelSink = false;
    this.isColonistSink = false;
    //
    this.target = {
        clans: this.planet.clans,
        megacredits: this.planet.megacredits,
        supplies: this.planet.supplies,
        neutronium: this.planet.neutronium
    };
    this.popGrowthObstacle = [];
    this.maxIncome = 5000;
    this.mineralDepletions = false;
    this.meanMineralDepletion = false;
    //
    if (vgap.map.canvas && draw)
    {
        this.drawIndicators(); // INDICATORS
    } else
    {
        //this.isGuarded = this.getFleet();
        this.defaultDefense = this.setDefaultDefense();
        //
        this.curColPopGrowth = this.getColonistGrowth();
        this.curNatPopGrowth = this.getNativeGrowth();
        this.maxColPop = this.getMaxColPop();
        this.minColPop = this.getMinColPop(); // minimum for growth
        this.minGrowthColPop = this.getMinGrowthColPop(); // minimum population for growth
        this.squeezeColPop = this.getSqueezeColPop(); // population to be able to squeeze max (max. 5000)
        this.maxNatPop = this.getMaxNatPop();
        this.revenue = this.getRevenue();
        this.optNatTaxClans = this.getOptNatTaxClans();
        this.optBovSupClans = this.getOptBovSupClans();
        //
        this.mineralProduction = this.getMineralProduction();
        this.k75Minerals = this.getMineralClassStatus();
        this.k50Minerals = this.getMineralClassStatus("ground", 50);
        this.structures = this.getStructures();
        //
        if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.setBuildTargets();
        this.optLabor = this.getOptLabor();
        if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildStructures();
        if (autopilot.settings.planetMNG && build && this.isSellingSupply) this.sellSupply();
        this.setMeanMineralDepletion(); // independent of this.mineralProduction
        //
        if (autopilot.settings.planetMNG) this.setTaxes();
        this.setTransitFuelRequest();
        this.update(pid, build);
    }
}
/*
    AUTORUN
 */
Colony.prototype.initializeBalance = function()
{
    this.balance = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0,
        supplies: 0,
        megacredits: 0,
        clans: 0
    };
    this.setPlanetDeficiency();
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
};
Colony.prototype.drawIndicators = function()
{
    if (this.hasStarbase || this.isBuildingBase) this.drawStarbaseIndicators(); // map indicator
    if (this.isFort) this.drawFortIndicators();
    if (this.isSqueezingPopulations()) this.drawTaxMissionIndicator();
    this.drawMineralValueIndicator();
    this.drawMineralDetailIndicator();
    this.drawStructuresIndicator();
    this.drawNativeIndicators();
};
/*
    GENERAL
 */
Colony.prototype.update = function(pid, build)
{
    if (typeof pid === "undefined") pid = this.pid;
    if (typeof build === "undefined") build = false;
    //
    this.isBuildingBase = this.isBuildingStarbase();
    this.isFort = this.isFortifying(); // a purely defensive base
    this.isSellingSupply = this.getSellingSupply();
    this.isBuildingStructures = this.getBuildingStructures();
};
Colony.prototype.getPlanetOwner = function()
{
    return this.planet.ownerid > 0 ? vgap.players[this.planet.ownerid - 1].raceid : vgap.player.raceid;
};
Colony.prototype.getFleet = function()
{
    let fleet = [];
    let ships = vgap.shipsAt(this.planet.x, this.planet.y);
    if (ships)
    {
        ships.forEach(function (s) {
            let cH = vgap.getHull(s.hullid);
            if (s.ownerid === vgap.player.id && cH.mass >= 150 && s.beams > 0 && ((s.torps > 0 || s.bays > 0) && s.ammo > 0)) fleet.push(s);
            // toDo: primary enemy set? kill mission set? => APS function: APS.fleetProtectsAPS"
        });
    }
    return fleet;
};
Colony.prototype.determineSafety = function()
{
    let s = this.getSafetyStatus();
    return ((s.enemyShips.length === 0 && s.enemyPlanets.length === 0) || (s.ownMinefields.length > 0 && s.enemyMinefields.length === 0)) &&
        !s.ionStormDanger && s.starclusters.length === 0;
};
Colony.prototype.getSafetyStatus = function()
{
    // ion storms
    let ionStorms = autopilot.objectInsideIonStorm(this.planet);
    let dangerousIonStorms = ionStorms.filter(function (s) {
        return (s.isgrowing && Math.floor(s.voltage * 1.2) >= 150) || s.voltage >= 150;
    });
    let cIsInDangerousIonstorm = dangerousIonStorms.length > 0;
    // starclusters
    let starclusters = autopilot.objectInsideStarCluster(this.planet);
    // mine fields
    let withinEnemyMinefield = autopilot.objectInsideEnemyMineField(this.planet);
    let protectedByMinefield = autopilot.objectInsideOwnMineField(this.planet);
    // enemy (ships & planets)
    let closeEnemyPlanets = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyPlanets, 81, this.planet);
    let closeEnemyShips = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyShips, 81, this.planet);

    return {
        ionStorms: ionStorms,
        ionStormDanger: cIsInDangerousIonstorm,
        starclusters: starclusters,
        enemyMinefields: withinEnemyMinefield,
        ownMinefields: protectedByMinefield,
        enemyPlanets: closeEnemyPlanets,
        enemyShips: closeEnemyShips
    };
};
/*
    POSITIONAL INFO
 */
Colony.prototype.getDistanceToEnemyPlanet = function()
{
    let enemyPlanets = this.getCloseEnemyPlanets();
    if (enemyPlanets)
    {
        enemyPlanets.sort(function (a, b) { return a.distance - b.distance; });
        return enemyPlanets[0].distance;
    } else
    {
        return false;
    }
};
Colony.prototype.getCloseEnemyPlanets = function()
{
    // only consider planets inside a safety zone (i.e. 300 ly)
    let p = this.planet;
    let closeEnemyPlanets = autopilot.getTargetsInRange(autopilot.frnnEnemyPlanets, p.x, p.y, 300);
    if (closeEnemyPlanets.length > 0)
    {
        closeEnemyPlanets.forEach(
            function (eP, idx) {
                closeEnemyPlanets[idx].distance = Math.floor(autopilot.getDistance( { x: p.x, y: p.y }, { x: eP.x ,y: eP.y } ));
            }
        );
        return closeEnemyPlanets;
    } else
    {
        return false;
    }
};
/*
    MINERALS, FUEL and SUPPLY
 */
Colony.prototype.setPlanetMineralExcess = function()
{
    let p = this.planet;
    this.balance.duranium += p.duranium;
    this.balance.tritanium += p.tritanium;
    this.balance.molybdenum += p.molybdenum;
};
Colony.prototype.setPlanetDeficiency = function()
{
    this.balance.supplies = this.getSupplyDeficiency(); // needs to be calculated before megacredits, since supplies can be transformed to MCs
    this.balance.megacredits = this.getMcDeficiency();
    this.balance.clans = this.getClanDeficiency();
    this.balance.neutronium = this.getFuelDeficiency();
    //console.log("...1. balance:", this.balance);
    this.setPlanetMineralExcess();
    //console.log("...2. balance:", this.balance);
    this.setShipsResourceDemands();
    //console.log("...final balance:", this.balance);
};
Colony.prototype.setShipsResourceDemands = function()
{
    let p = this.planet;
    if (autopilot.refineryAtPlanet(p)) this.balance.supplies -= 1050;
    if (autopilot.alchemyAtPlanet(p)) this.balance.supplies -= 2700;
    let lfmShips = autopilot.getLFMships(p);
    let self = this;
    if (lfmShips.length > 0)
    {
        lfmShips.forEach(function (s) {
            let curCapacity = autopilot.getCurCargoCapacity(s);
            let potentialFighters = Math.floor(curCapacity / 10);
            if (potentialFighters > 0) {
                self.balance.tritanium -= potentialFighters * 3;
                self.balance.molybdenum -= potentialFighters * 2;
                self.balance.supplies -= potentialFighters * 5;
            }
        });
    }
    //
    if (!this.hasStarbase)
    {
        let damagedShips = autopilot.getDamagedShips(p);
        if (damagedShips.length > 0)
        {
            damagedShips.forEach(function (s) {
                if (s.damage > 0 && s.supplies < s.damage * 5) self.balance.supplies -= (s.damage * 5) - s.supplies;
            });
        }
    }
    this.setAPSresourceDemands();
    this.setAPSresourceDeliveries();
};
Colony.prototype.setAPSresourceDemands = function()
{
    let apsWithDemand = autopilot.getAPSwithDestination(this.planet, true); // with this colony as secondary destination = pick up
    if (apsWithDemand.length > 0)
    {
        //console.log("APS with possible demand: ", apsWithDemand);
        let self = this;
        apsWithDemand.forEach(function (aps) {
            if (aps.shipFunction === "dis" || aps.shipFunction === "bld")
            {
                const s = vgap.getShip(aps.sid);
                let curCapacity = autopilot.getCurCargoCapacity(s);
                let curMcCapacity = 10000 - s.megacredits;
                const dC = autopilot.getColony(aps.destination);
                let demand = [];
                if (aps.shipFunction === "dis")
                {
                    demand = dC.getDistributorDemand(aps.ooiPriority);
                } else if (aps.shipFunction === "bld")
                {
                    demand = dC.getBuilderDemand(aps.ooiPriority);
                }
                //console.log("..considering demand:", dC.planet.id, demand);
                if (demand.length > 0)
                {
                    demand.forEach(function (d) {
                        if (curCapacity && d.item !== "megacredits")
                        {
                            let take = 0;
                            if (self.balance[d.item] > 0)
                            {
                                if (self.balance[d.item] >= d.value)
                                {
                                    take = d.value;
                                } else {
                                    take = self.balance[d.item];
                                }
                                if (curCapacity >= take)
                                {
                                    self.balance[d.item] -= take;
                                    curCapacity -= take;
                                    //console.log("...reducing %s balance of Colony by %d", d.item, take);
                                } else
                                {
                                    self.balance[d.item] -= curCapacity;
                                    curCapacity = 0;
                                    //console.log("...reducing %s balance of Colony by %d", d.item, curCapacity);
                                }
                            }
                        } else if (curMcCapacity && d.item === "megacredits") {
                            //console.log("Megacredit DEMAND:", d);
                            let take = 0;
                            if (self.balance[d.item] > 0)
                            {
                                if (self.balance[d.item] >= d.value)
                                {
                                    take = d.value;
                                } else {
                                    take = self.balance[d.item];
                                }
                                if (curMcCapacity >= take)
                                {
                                    self.balance[d.item] -= take;
                                    curMcCapacity -= take;
                                } else
                                {
                                    self.balance[d.item] -= curMcCapacity;
                                    curMcCapacity = 0;
                                }
                            }
                        }
                    });
                }
            }
        });
    }
};
Colony.prototype.addShipCargoToBalance = function(ship)
{
    let resources = this.resources.filter(function (r) {
        return ship[r] > 0;
    });
    for (let i = 0; i < resources.length; i++)
    {
        //console.log("...adding %d %s to balance...", ship[resources[i]], resources[i]);
        this.balance[resources[i]] += ship[resources[i]];
    }
};
Colony.prototype.setAPSresourceDeliveries = function()
{
    let apsWithDelivery = autopilot.getAPSwithDestination(this.planet); // with this colony as destination = dropping off
    if (apsWithDelivery.length > 0)
    {
        //console.log("APS with possible delivery: ", apsWithDelivery);
        let self = this;
        apsWithDelivery.forEach(function (aps) {
            let s = vgap.getShip(aps.sid);
            if (aps.shipFunction === "dis" || aps.shipFunction === "bld")
            {
                self.addShipCargoToBalance(s);
            }
        });
    }
};
Colony.prototype.setFortMineralExcess = function()
{
    // keep 100 of each building mineral
    this.balance.duranium -= 100;
    this.balance.tritanium -= 100;
    this.balance.molybdenum -= 100;
};
Colony.prototype.getFuturePlanetResources = function(turns)
{
    let p = this.planet;
    if (typeof turns === "undefined") turns = 1;
    //
    let mines = parseInt(p.mines);
    let factories = parseInt(p.factories);
    let supplies = parseInt(p.supplies);
    //
    let neu = parseInt(p.neutronium);
    let gneu = parseInt(p.groundneutronium);
    let dneu = parseInt(p.densityneutronium);
    let theoNeu = Math.floor((dneu / 100) * mines) * turns;
    let actNeu = theoNeu + neu;
    if (theoNeu > gneu) actNeu = gneu + neu;
    //
    let dur = parseInt(p.duranium);
    let gdur = parseInt(p.groundduranium);
    let ddur = parseInt(p.densityduranium);
    let theoDur = Math.floor((ddur / 100) * mines) * turns;
    let actDur = theoDur + dur;
    if (theoDur > gdur) actDur = gdur + dur;
    //
    let tri = parseInt(p.tritanium);
    let gtri = parseInt(p.groundtritanium);
    let dtri = parseInt(p.densitytritanium);
    let theoTri = Math.floor((dtri / 100) * mines) * turns;
    let actTri = theoTri + tri;
    if (theoTri > gtri) actTri = gtri + tri;
    //
    let mol = parseInt(p.molybdenum);
    let gmol = parseInt(p.groundmolybdenum);
    let dmol = parseInt(p.densitymolybdenum);
    let theoMol = Math.floor((dmol / 100) * mines) * turns;
    let actMol = theoMol + mol;
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
    let p = this.planet;
    let target = parseInt(autopilot.settings.defNeuRetention); // default
    if (this.hasStarbase) target += parseInt(autopilot.settings.sbNeuRetention);
    if (this.isFort) target += parseInt(autopilot.settings.frtNeuRetention);

    let alchemyAtPlanet = autopilot.alchemyAtPlanet(p);
    if (alchemyAtPlanet)
    {
        target += 400;
    }
    let apsIdleFuel = autopilot.getIdleAPSfuelDeficiency(p);
    if (apsIdleFuel)
    {
        target += apsIdleFuel;
    }
    let nonApsFuel = autopilot.getNonAPSfuelDeficiency(p);
    if (nonApsFuel)
    {
        target += nonApsFuel;
    }
    this.target.neutronium = target;
};
Colony.prototype.getFuelDeficiency = function()
{
    let p = this.planet;
    this.setTargetNeutronium();
    let deficiency = p.neutronium + this.getMineralOutput("neutronium") - this.target.neutronium;
    if (deficiency > 0) deficiency -= this.getMineralOutput("neutronium");
    if (deficiency < 0)
    {
        this.isFuelSink = true;
    }
    return Math.floor(deficiency);
};
Colony.prototype.setTargetSupplies = function()
{
    let p = this.planet;
    let s = this.getStructures();
    let target = parseInt(autopilot.settings.defSupRetention); // retain x supplies on planet
    let sB = vgap.getStarbase(p.id);
    if (sB && !this.isFort) target += parseInt(autopilot.settings.sbSupRetention); // retain x more supplies on planet if sb is present
    target += (s.factories.def * 3);
    target += (s.mines.def * 4);
    target += (s.defense.def * 10);
    this.target.supplies = target;
};
Colony.prototype.getSupplyDeficiency = function()
{
    let p = this.planet;
    this.setTargetSupplies();
    let deficiency = p.supplies + p.factories - this.target.supplies;
    if (deficiency > 0) {
        deficiency -= p.factories;
    }
    return deficiency;
};
Colony.prototype.setTransitFuelRequest = function()
{
    // check if ships are at planet...
    // For each ship, we request the amount necessary to fly to the closest neighbor planet.
    let p = this.planet;
    let ships = vgap.shipsAt(p.x, p.y);
    let closest = autopilot.getClosestPlanet({ x: p.x, y: p.y});
    if (closest)
    {
        for (let i = 0; i < ships.length; i++)
        {
            if (ships[i].ownerid !== vgap.player.id) continue;
            let cS = ships[i];
            let cRequest = Math.floor(autopilot.getOptimalFuelConsumptionEstimate(cS.id, [], closest.distance));
            //console.log(cRequest);
            let isAPS = autopilot.isInStorage(cS.id);
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
    let m = autopilot.minerals;
    let production = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    for(let i = 0; i < m.length; i++)
    {
        production[m[i]] = this.getMineralOutput(m[i], mines);
    }
    return production;
};
Colony.prototype.getMineralOutput = function(mineral, mines)
{
    let p = this.planet;
    if (typeof mines === "undefined") mines = p.mines;
    if (vgap.player.raceid === 2 || p.nativeracename === "Reptilians")  mines *= 2;
    let theo = Math.round( (parseInt(p["density" + mineral]) / 100) * mines );
    let ground = parseInt(p["ground" + mineral]);
    if (ground >= theo) return theo;
    return ground;
};
Colony.prototype.getMineralStats = function()
{
    let p = this.planet;
    let sumAll = p.groundneutronium + p.groundduranium + p.groundtritanium + p.groundmolybdenum;
    let sumBld = p.groundduranium + p.groundtritanium + p.groundmolybdenum;
    let sumTop = p.groundduranium + p.groundmolybdenum;
    let TopBld = Math.round((sumTop / sumBld) * 100); // x 100 = x % of build minerals are rare minerals
    let TopAll = Math.round((sumTop / sumAll) * 100); // x 100 = x % of all minerals are rare minerals
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
    let extraction = this.getMineralOutput(mineral, mines);
    return Math.floor(parseInt(this.planet["ground" + mineral]) / extraction);
};
Colony.prototype.setMeanMineralDepletion = function(types)
{
    if (typeof types === "undefined") types = autopilot.minerals;
    if (!this.mineralDepletions) this.setMineralDepletions();
    let depletion = 0;
    for (let i = 0; i < this.mineralDepletions.length; i++)
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
    let p = this.planet;
    // return object with minerals and turns till depletion and remaining ground mineral
    let data = [];
    for (let i = 0; i < autopilot.minerals.length; i++)
    {
        let deplTurns = this.getDepletionTurns(autopilot.minerals[i]);
        let diff = p.mines - p.targetmines;
        data.push({ mineral: autopilot.minerals[i], turns: deplTurns, remaining: p["ground" + autopilot.minerals[i]], mines: diff});
    }
    data.sort(
        function(a, b)
        {
            let x = a.turns;
            let y = b.turns;
            if (x < y) {return 1;}
            if (x > y) {return -1;}
            return 0;
        }
    );
    this.mineralDepletions = data;
};
Colony.prototype.getSumOfAllMinerals = function()
{
    let p = this.planet;
    return p.neutronium+p.duranium+p.tritanium+p.molybdenum+p.groundneutronium+p.groundduranium+p.groundtritanium+p.groundmolybdenum;
};
Colony.prototype.getSurfaceMinerals = function()
{
    let p = this.planet;
    return {
        dur: p.duranium,
        tri: p.tritanium,
        mol: p.molybdenum,
        bld: p.duranium+p.tritanium+p.molybdenum,
        neu: p.neutronium
    }
};
Colony.prototype.getMineralClassStatus = function(location, k)
{
    if (typeof location === "undefined") location = "ground";
    if (typeof k === "undefined") k = 75;
    let p = this.planet;
    let kRichMinerals = [];
    autopilot.minerals.forEach(function (m) {
        let aboveThreshMean = autopilot.getAboveKpercentileMean(autopilot.globalMinerals[location].values[m], k);
        //console.log("AboveThreshMean of %s = %s.", m, aboveThreshMean);
        if (location === "ground" && p["ground" + m] >= aboveThreshMean)
        {
            kRichMinerals.push( m );
        } else if (location === "surface" && p[m] >= aboveThreshMean)
        {
            kRichMinerals.push( m );
        }
    });
    return kRichMinerals;
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
    let p = this.planet;
    // Mines
    let mM = this.getMaxMines();
    let mDef = 0;
    if (p.targetmines > p.mines) mDef = p.targetmines - p.mines;
    let mP = this.getMineralProduction(p.mines);
    // Factories
    let mF = this.getMaxFactories();
    let fDef = 0;
    if (p.targetfactories > p.factories) fDef = p.targetfactories - p.factories;
    // Defense
    let mD = this.getMaxDefense();
    let dDef = 0;
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
//  PLANETARY
Colony.prototype.getMaxMines = function()
{
    let p = this.planet;
    let maxMines = 0;
    if (this.maxColPop >= 200)
    {
        maxMines = 200 + Math.sqrt(this.maxColPop - 200);
    } else
    {
        maxMines = this.maxColPop;
    }
    let mM = Math.floor(parseInt(maxMines));
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
    let p = this.planet;
    let maxFact = 0;
    if (this.maxColPop >= 100)
    {
        maxFact = 100 + Math.sqrt(this.maxColPop - 100);
    } else
    {
        maxFact = this.maxColPop;
    }
    let mF = Math.floor(parseInt(maxFact));
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
    let p = this.planet;
    let maxDefe = 0;
    if (this.maxColPop >= 50)
    {
        maxDefe = 50 + Math.sqrt(this.maxColPop - 50);
    } else
    {
        maxDefe = this.maxColPop;
    }
    let mD = Math.floor(parseInt(maxDefe));
    if (p.clans >= 50)
    {
        maxDefe = 50 + Math.sqrt(p.clans - 50);
    } else
    {
        maxDefe = p.clans;
    }
    return { max: mD, maxNow: Math.floor(maxDefe) };
};
Colony.prototype.setDefaultDefense = function()
{
    let dD = parseInt(autopilot.settings.defPlanetDef);
    if (this.hasStarbase)
    {
        dD += parseInt(autopilot.settings.defPlanetSbDef);
    }
    if (this.isFort)
    {
        dD += parseInt(autopilot.settings.defPlanetFortDef);
    }
    return dD;
};
Colony.prototype.setBuildTargets = function()
{
    if (this.isOwnPlanet && !this.isDoomed())
    {
        this.updateStructures();
        // Mines
        this.adjustTargetMines();
        // Factories
        this.adjustTargetFactories();
        // Defense
        this.adjustTargetDefense();
    } else
    {
        this.planet.targetmines = 0;
        this.planet.targetfactories = 0;
    }
};
Colony.prototype.adjustTargetMines = function()
{
    let p = this.planet;
    let sF = this.structures.factories;
    let sM = this.structures.mines;
    if (sM.def === 0)
    {
        p.targetmines = 0; // reset
        let stats = this.getMineralStats(); // ground minerals
        if (p.factories >= 50 || p.factories >= sF.maxNow)
        {
            if (this.k50Minerals.length === 0 || p.mines < 50)
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
                if (this.k50Minerals.length > 0)
                {
                    if (sM.maxNow >= 100)
                    {
                        p.targetmines = 100;
                    } else
                    {
                        p.targetmines = sM.maxNow;
                    }
                }
                //console.log("Planet " + p.id + " is depleted... Mines: " + p.mines + " Minerals: " + stats.sumAll);
            }
        }
        // special cases:
        // - do not use maxNow as limit. Thus will result in population demand for builders or local collectors
        if (this.k75Minerals.length > 0 && (p.factories >= 50 || p.factories === sF.maxNow))
        {
            let depletion = this.getMeanMineralDepletion( this.k75Minerals );
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
            if (p.mines >= 50 && p.mines <= 190)
            {
                if (depletion > 50 && p.mines <= 175)
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
    let p = this.planet;
    let f = p.factories;
    let sF = this.structures.factories;
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
    let p = this.planet;
    let dD = this.defaultDefense;
    let sD = this.structures.defense;
    let sF = this.structures.factories;
    let sM = this.structures.mines;
    p.targetdefense = 0; // reset
    if (sF.def === 0 && (p.factories >= 50 || p.factories >= sF.maxNow) && sM.def === 0 && (p.mines >= 50 || p.mines >= sM.maxNow))
    {
        if (this.isFort)
        {
            p.targetdefense = Math.floor(sD.max * 0.95); // only set to 95 % of maximum defense, reserves population for distribution / development of planets
        } else
        {
            if (p.defense < dD)
            {
                p.targetdefense = dD;
            }
        }
        this.updateStructures();
    }
};
Colony.prototype.buildFactories = function(n)
{
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 3
    };
    let sF = this.structures.factories;
    for (let i = 0; i < n; i++)
    {
        if (p.megacredits < cost.megacredits && p.supplies > cost.megacredits)
        {
            let mcDef = cost.megacredits - p.megacredits;
            this.sellSupply(true, false, mcDef);
        }
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
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 4
    };
    let sM = this.structures.mines;
    for (let i = 0; i < n; i++)
    {
        if (p.megacredits < cost.megacredits && p.supplies > cost.megacredits)
        {
            let mcDef = cost.megacredits - p.megacredits;
            this.sellSupply(true, false, mcDef);
        }
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
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 10
    };
    let sD = this.structures.defense;
    for (let i = 0; i < n; i++)
    {
        if (p.megacredits < cost.megacredits && p.supplies > cost.megacredits)
        {
            let mcDef = cost.megacredits - p.megacredits;
            this.sellSupply(true, false, mcDef);
        }
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
    if (this.isOwnPlanet && !this.isDoomed())
    {
        // Factories
        let fS = this.structures.factories;
        if (fS.def > 0) this.buildFactories(fS.def);
        // Mines
        let mS = this.structures.mines;
        if (mS.def > 0) this.buildMines(mS.def);
        // Defense
        let dS = this.structures.defense;
        if (dS.def > 0) this.buildDefense(dS.def);
    }
};
Colony.prototype.getMinesForDepletion = function(mineral, turns)
{
    let density = this.planet["density" + mineral] / 100;
    let deposits = this.planet["ground" + mineral];
    // mines * densNeu = depletionTurns / this.planet.groundneutronium;
    //console.log("There are " + deposits + "kt (" + density + " density) of " + mineral + " in the ground!");
    return Math.floor((deposits / turns) / density);
    //console.log("With " + mines + " mines (" + density + " * " + (deposits / turns) + "), kt of " + mineral + " in ground");
    //return mines;
};
//  STARBASE
Colony.prototype.setStarbaseProduction = function()
{
    let p = this.planet;
    let sb = this.hasStarbase;
    let sbD = {
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
    let minPro = this.mineralProduction;
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
Colony.prototype.getStarbaseTechMcDeficiency = function(tecs)
{
    let sb = this.hasStarbase;
    let mcDeficiency = 0;
    if (tecs.length > 0)
    {
        tecs = tecs.filter(function (t) {
            return t.demand < sb[t.name+"techlevel"];
        });
        let self = this;
        tecs.forEach(
            function (tec, index) {
                mcDeficiency += self.getTechDeficiency(sb[tec.name+"techlevel"],tec.demand);
            }
        );
    }
    return mcDeficiency;
};
Colony.prototype.setStarbaseDeficiency = function()
{
    let sb = this.hasStarbase;
    let tecLvls = [];
    let sbD = {
        megacredits: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    let torpCost = [0,1,2,5,10,12,13,31,35,36,54];  // cost per torp by tec level
    //
    let minSbFighter = parseInt(autopilot.settings.minSbFighter); // Each base should be defended by at least 20 fighter
    let minSbDefense = parseInt(autopilot.settings.minSbDefense); // Each base should be defended by at least 50 sb defense posts

    //
    // ship production, torpedo production
    //
    if (this.isFort)
    {
        minSbFighter = 60; // maximize fighter defense
        minSbDefense = 200; // maximize defense posts
        tecLvls = [
            {
                name: "beam",
                demand: 10
            }
        ];
        // torpedo building backup (100 with max available torp tec)
        sbD.megacredits += 100 * torpCost[sb.torptechlevel];
    } else
    {
        tecLvls = [ // basic starbase
            {
                name: "hull",
                demand: 3
            },
            {
                name: "engine",
                demand: 6
            },
            {
                name: "beam",
                demand: 4
            },
            {
                name: "torp",
                demand: 6
            }
        ];
        this.setStarbaseProduction();
    }
    if (tecLvls.length > 0)
    {
        let tecMcDef = this.getStarbaseTechMcDeficiency(tecLvls);
        if (tecMcDef)
        {
            console.log("Starbase technological deficiency detected:", tecMcDef);
            sbD.megacredits += tecMcDef;
        }
    }

    // Starbase Defense (Fighter)
    sbD.tritanium += (minSbFighter - sb.fighters) * 3;
    sbD.molybdenum += (minSbFighter - sb.fighters) * 2;
    sbD.megacredits += (minSbFighter - sb.fighters) * 100;
    // Starbase Defense (Defense Posts)
    sbD.duranium += (minSbDefense - sb.defense);
    sbD.megacredits += (minSbDefense - sb.defense) * 10;
    //
    let minPro = this.mineralProduction;
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
Colony.prototype.getTechDeficiency = function(curTech, wantTech)
{
    if (curTech === 10) return 0;
    if (typeof wantTech === "undefined") wantTech = 10;
    if (typeof wantTech !== "undefined" && wantTech < 2) wantTech = 2;
    let def = 0;
    for (let i = curTech; i < wantTech; i++)
    {
        def += (i * 100);
    }
    return def;
};
/*
    POPULATIONS, TAXES and MEGACREDITS
 */
Colony.prototype.getRevenue = function(taxation)
{
    if (typeof taxation !== "undefined" && taxation && (taxation === "default" || taxation === "growth"))
    {
        let revenue = 0;
        if (taxation === "default")
        {
            revenue += this.getIncomeFromColonists(this.getMaxHappyColonistTaxRate());
            if (this.planet.nativeclans > 0) revenue += this.getIncomeFromNatives(this.getMaxHappyNativeTaxRate());
        } else if (taxation === "growth")
        {
            revenue += this.getIncomeFromColonists(this.getMinHappyColonistTaxRate());
            if (this.planet.nativeclans > 0) revenue += this.getIncomeFromNatives(this.getMinHappyNativeTaxRate());
        }
        return revenue;
    } else
    {
        return Math.floor(this.getIncomeFromNatives() + this.getIncomeFromColonists());
    }
};
Colony.prototype.setTargetMegacredits = function()
{
    let s = this.getStructures();
    let target = parseInt(autopilot.settings.defMcsRetention); // default minimum amount at planet
    target += (s.factories.def * 3);
    target += (s.mines.def * 4);
    target += (s.defense.def * 10);
    if (this.hasStarbase) target += parseInt(autopilot.settings.sbMcsRetention); // default minimum amount at starbases
    this.target.megacredits = target;
};
Colony.prototype.getMcDeficiency = function()
{
    this.setTargetMegacredits();
    let p = this.planet;
    let deficiency = p.megacredits + this.getRevenue() - this.target.megacredits;
    //console.log("getMCDeficiency: p.megacredits = ",  p.megacredits);
    if (deficiency > 0) deficiency -= this.getRevenue();
    if (deficiency < 0)
    {
        if (this.balance.supplies > 0) deficiency += this.balance.supplies;
    }
    //console.log("getMCDeficiency: ",  deficiency);
    return deficiency;
};
Colony.prototype.setTaxes = function()
{
    //console.log("APP: Setting taxes...")
    let p = this.planet;
    if (this.isSqueezingPopulations()) this.squeezeTaxes(); // colonists and natives
    if (this.isDoomed()) p.colonisttaxrate = 100;
    if (this.isDoomed() && p.nativeclans > 0 && p.nativeracename !== "Amorphous") p.nativetaxrate = 100;
    if (this.isTaxingByDefault()) { this.taxation = "default"; this.setDefaultTaxrate(); }
    if (this.isTaxing4Growth()) { this.taxation = "growth"; this.setGrowthTaxrate(); }
};
//  NATIVES
Colony.prototype.getNativeGrowth = function(taxrate)
{
    let p = this.planet;
    if (typeof taxrate === "undefined") taxrate = p.nativetaxrate;
    let growth = 0;
    let growthModifier = 1;
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
    let p = this.planet;
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
    let optClans = Math.ceil(this.getIncomeFromNatives(taxrate));
    if (optClans > this.maxColPop) optClans = this.maxColPop;
    return optClans;
};
Colony.prototype.getNativeHappinessChange = function(taxrate) // returns -/0/+ amount of happynesspoints = change in happiness using taxrate
{
    let p = this.planet;
    let nativeRaceBonus = p.nativeracename === "Avian" ? 10 : 0;
    let nebulaBonus = 0; // toDo: get nebulaBonus // The Nebula Bonus is 5 if the planet is in a nebula and has less than 50 light-years visibility.
    let addHappyness = 0;
    if (vgap.player.raceid === 2) // Lizards
    {
        let ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0)
        {
            ships.forEach(function (s) {
                if (s.mission === 8) addHappyness += 5; // Hisssss
            });
            //if (addHappyness) console.log("Ships are hissing planet %s: + %s native Happiness", p.id, addHappyness);
        }
    }
    return addHappyness + (Math.round( (1000 - Math.sqrt(p.nativeclans) - 85 * taxrate - Math.round( (p.mines + p.factories) / 2 ) - 50 * (10 - p.nativegovernment)) ) / 100) + nativeRaceBonus + nebulaBonus;
};
Colony.prototype.getMaxHappyNativeTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (let i=50; i>0; i--)
    {
        let happinessChange = this.getNativeHappinessChange(i);
        if (happinessChange > -1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMinHappyNativeTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (let i = 1; i < 50; i++)
    {
        let happinessChange = this.getNativeHappinessChange(i);
        if (happinessChange < 1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMaxIncomeFromNatives = function()
{
    let p = this.planet;
    if (p.nativeclans > 0)
    {
        let taxrate = 100;
        let income = this.getIncomeFromNatives(taxrate);
        if (income > 5000) return 5000;
        return Math.ceil(income);
    } else {
        return 0;
    }
};
Colony.prototype.getIncomeFromNatives = function(taxRate)
{
    let p = this.planet;
    // Taxes = (Native Clans) * (Native Tax Rate) * (Planet Tax Efficiency=Native Government / 5) / 10
    if (typeof taxRate === "undefined") taxRate = p.nativetaxrate;
    if (p.nativeclans > 0) {
        let race = this.owner;
        if (race === 6) if (taxRate > 20) taxRate = 20;
        let income = p.nativeclans * (taxRate / 100) * (p.nativegovernment / 5) / 10;
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
    let p = this.planet;
    return (p.nativeracename === "Ghipsoldal" ||
        p.nativeracename === "Amphibian" ||
        p.nativeracename === "Humanoid" ||
        p.nativeracename === "Siliconoid");
};
//  COLONISTS
Colony.prototype.getMaxColPop = function()
{
    let p = this.planet;
    if (p.temp > -1)
    {
        let race = this.owner;
        if (race === 7) // crystalline
        {
            return (p.temp * 1000);
        } else if (p.temp > 84 && (race === 4 || race === 9 || race === 10 || race === 11)) // desert worlds // toDo: this is usually > 80, but seems wrong
        {
            return 60;
        } else if (p.temp > 84) // desert worlds
        {
            return Math.floor( ( 20099.9 - (200 * p.temp) ) / 10 );
        } else if (p.temp < 19 && race === 10) // arctic worlds
        {
            return 90000;
        } else if (p.temp < 15) // arctic worlds
        {
            return Math.floor( ( 299.9 + (200 * p.temp) ) / 10 );
        } else // temperate worlds
        {
            return Math.round(Math.sin(3.14 * (100 - p.temp) / 100 ) * 100000);
        }
    }
    return null;
};
Colony.prototype.getColonistGrowth = function(taxrate)
{
    let p = this.planet;
    if (typeof taxrate === "undefined") taxrate = p.colonisttaxrate;
    let growthModifier = 1;
    let race = this.owner;
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
        let tempFactor = Math.sin(3.14 * ((100 - p.temp) / 100));
        let clanFactor = p.clans / 20;
        let taxFactor = 5 / (taxrate + 5);
        // console.log({ tempFactor: tempFactor, clanFactor: clanFactor, taxFactor: taxFactor});
        // ROUND( SIN(3.14 * (100 - (Planet Temperature)) / 100)  * (Colonist Clans) / 20 * 5 / ((Colonist Tax Rate) + 5) )
        let curGrowth = growthModifier * Math.round( tempFactor * clanFactor * taxFactor );
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
    let optLabor = this.getOptLabor();
    if (optLabor > 0) return optLabor;
    return 1;
};
Colony.prototype.getMinGrowthColPop = function()
{
    let p = this.planet;
    // check minimum colonist population to achieve population growth under current circumstances (ignores happiness!)
    let race = this.owner;
    let startClans = 1;
    let tempFactor = Math.sin(Math.PI * ((100 - p.temp) / 100));
    if (race === 7) tempFactor = p.temp / 100; // crystalline
    let clanFactor = startClans / 20;
    let taxFactor = 5 / (p.colonisttaxrate + 5);
    let growthClans = Math.round( tempFactor * clanFactor * taxFactor );
    let addClans = 1;
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
    let p = this.planet;
    let defense = 15; // avoid detection
    if (p.targetdefense > 15) defense = p.targetdefense;
    let pStructures = [
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
            let x = a.optLabor;
            let y = b.optLabor;
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
    let p = this.planet;
    let raceMod = 1; // toDo: Federation = 2
    let baseTemp = 50;
    let addHappyness = 0;
    if (vgap.player.raceid === 7) baseTemp = 100; // Crystals
    if (vgap.player.raceid === 2) // Lizards
    {
        let ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0)
        {
            ships.forEach(function (s) {
                if (s.mission === 8) addHappyness += 5; // Hisssss
            });
            //if (addHappyness) console.log("Ships are hissing planet %s: + %s Happiness", p.id, addHappyness);
        }
    }
    // Colonists: TRUNC((1000 - SQRT(Colonist Clans) - 80 * (Colonist Tax Rate) - ABS(BaseTemp - Temperature) * 3 - (Factories + Mines) / 3 ) /100)
    return addHappyness + ( Math.round( (1000 - Math.sqrt(p.clans) - 80 * taxrate - Math.abs(baseTemp - p.temp) * 3 - (p.mines + p.factories) / 3 ) / 100) );

};
Colony.prototype.getMaxHappyColonistTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (let i = 50; i > 0; i--)
    {
        let happinessChange = this.getColonistHappinessChange(i);
        if (happinessChange > -1)
        {
            return i;
        }
    }
    return null;
};
Colony.prototype.getMinHappyColonistTaxRate = function() // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (let i = 1; i < 50; i++)
    {
        let happinessChange = this.getColonistHappinessChange(i);
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
    let p = this.planet;
    if (this.maxColPop < 100 && this.maxColPop > 0)
    {
        this.target.clans = this.maxColPop;
        if (p.nativeracename === "Bovinoid") this.target.clans = this.optBovSupClans; // exception for bovinoids!
    } else
    {
        let targets = [ 100, this.optLabor ];
        if (this.minColPop) targets.push(this.minColPop);
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
    let p = this.planet;
    let deficiency = p.clans + this.curColPopGrowth - this.target.clans;
    if (deficiency > 0) deficiency -= this.curColPopGrowth;
    if (deficiency < 0)
    {
        this.isColonistSink = true;
    }
    return deficiency;
};
/*
    MISSIONS
*/
Colony.prototype.isDoomed = function()
{
    let cfg = autopilot.planetIsInStorage(this.planet.id);
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
    let cfg = autopilot.planetIsInStorage(this.pid);
    if (cfg)
    {
        if (this.hasStarbase && cfg.pMission === "bba")
        {
            cfg.pMission = false;
            autopilot.syncLocalPlaneteerStorage(cfg);
        }
        return (cfg.pMission === "bba" || this.planet.buildingstarbase);
    } else
    {
        return this.planet.buildingstarbase;
    }
};
Colony.prototype.getSellingSupply = function()
{
    let cfg = autopilot.planetIsInStorage(this.pid);
    if (cfg)
    {
        return (cfg.production === "ssu");
    } else
    {
        return false;
    }
};
Colony.prototype.getBuildingStructures = function()
{
    let cfg = autopilot.planetIsInStorage(this.pid);
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
    let cfg = autopilot.planetIsInStorage(this.pid);
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
    let cfg = autopilot.planetIsInStorage(this.pid);
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
    let cfg = autopilot.planetIsInStorage(this.pid);
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
    let cfg = autopilot.planetIsInStorage(this.pid);
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
    let p = this.planet;
    let curHappyChange = 0;
    let curIncome = 0;
    let happyExcess = 0;
    let startTaxation = 0;
    if (p.clans > 1000) // = 100000 colonists
    {
        //if (p.colonisttaxrate > 100) p.colonisttaxrate = 99;
        curHappyChange = this.getColonistHappinessChange(p.colonisttaxrate);
        let futureHappyness = p.colonisthappypoints + curHappyChange;
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
    let p = this.planet;
    let curHappyChange = 0;
    let curIncome = 0;
    let happyExcess = 0;
    let startTaxation = 0;
    if (p.nativeclans > 0 && p.nativegovernment >= 2 && p.nativeracename !== "Amorphous")
    {
        curHappyChange = this.getNativeHappinessChange(p.nativetaxrate);
        let futureHappyness = p.nativehappypoints + curHappyChange;
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
                let optTaxClans = this.getOptNatTaxClans((startTaxation - 1)); // how much clans we need to get all taxes
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
    this.squeezeNatives();
    this.squeezeColonists();
};
Colony.prototype.setDefaultTaxrate = function()
{
    let p = this.planet;
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
    let p = this.planet;
    p.nativetaxrate = 1;
    //
    if (parseInt(p.nativehappypoints) > 40)
    {
        let happyEquiTaxRate = Math.floor(this.getMaxHappyNativeTaxRate());
        //console.log("happyEquiTaxRate of planet %s = %s.", p.id, happyEquiTaxRate);
        let modIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        //console.log("Income of planet %s with happyEquiTaxRate = %s.", p.id, modIncome);

        //
        while (modIncome > p.clans) // get taxrate that fits the availability of colonists
        {
            happyEquiTaxRate--;
            modIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        if (happyEquiTaxRate > 0 && modIncome > 99)
        {
            p.nativetaxrate = happyEquiTaxRate;
        }
    }
};
Colony.prototype.setDefaultColonistTaxrate = function()
{
    // default:
    // - adjust taxrate so there is no change in happiness
    // - limited by income (> 99 mcs)
    // - no taxation if there are less than 40 happypoints
    //
    let p = this.planet;
    //
    if (parseInt(p.colonisthappypoints) > 40)
    {
        let happyEquiTaxRate = Math.floor(this.getMaxHappyColonistTaxRate());
        let curIncome = this.getIncomeFromColonists(happyEquiTaxRate);
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
    let p = this.planet;
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
    let p = this.planet;

    //
    if (parseInt(p.nativehappypoints) >= 70)
    {
        let happyEquiTaxRate = Math.floor(this.getMinHappyNativeTaxRate());
        let nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        //
        while (nativeTaxMcs > p.clans) // get taxrate that fits the availability of colonists
        {
            happyEquiTaxRate--;
            nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        let curIncome = this.getIncomeFromNatives(happyEquiTaxRate);
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
    let p = this.planet;
    //
    if (parseInt(p.colonisthappypoints) >= 70)
    {
        let happyEquiTaxRate = Math.floor(this.getMinHappyColonistTaxRate());
        let curGrowth = this.getColonistGrowth(happyEquiTaxRate);
        //console.log("Current colonist growth of planet %s = %s", p.id, curGrowth);
        if (curGrowth < 1)
        {
            while (curGrowth < 1 && happyEquiTaxRate > 0)
            {
                happyEquiTaxRate --;
                curGrowth = this.getColonistGrowth(happyEquiTaxRate);
            }
            if (happyEquiTaxRate > 1) happyEquiTaxRate --; // a little bit more growth
        }
        //console.log("Effective colonist growth of planet %s = %s", p.id, curGrowth);
        let curIncome = this.getIncomeFromColonists(happyEquiTaxRate);
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
    let p = this.planet;
};
Colony.prototype.sellSupply = function(force, useBalance, amount)
{
    let p = this.planet;
    if (typeof useBalance === "undefined") useBalance = true;
    if (typeof amount === "undefined") amount = p.supplies;
    if (typeof force === "undefined") force = false;
    let available = p.supplies;
    if (useBalance && this.balance.supplies < p.supplies) available = this.balance.supplies;
    if (available <= 0) return false;
    if (amount > available) amount = available;
    if (this.isSellingSupply || force)
    {
        //console.log("Planet %s sells %s supplies", this.planet.id, amount);
        p.supplies -= amount;
        p.suppliessold += amount;
        p.megacredits += amount;
        p.changed = 1;
    }
    return amount;
};
/*
    APS HELPERS
 */
Colony.prototype.getDistance = function (target)
{
    return Math.ceil(autopilot.getDistance( { x: this.planet.x, y: this.planet.y }, { x: target.x ,y: target.y } ));
};
Colony.prototype.getAPSCargo = function (aps)
{
    if (aps.primaryFunction === "col")
    {
        return this.getCollectorCargo(aps.objectOfInterest);
    } else if (aps.primaryFunction === "dis")
    {
        return this.getDistributorCargo(aps.objectOfInterest);
    } else if (aps.primaryFunction === "exp")
    {
        //return this.getExpanderCargo(ooi);
    } else if (aps.primaryFunction === "bld")
    {
        return this.getBuilderCargo(aps.destination.id, aps.objectOfInterest);
    }
};
Colony.prototype.getNextAPSCargo = function (aps, nD)
{
    if (aps.primaryFunction === "col")
    {
        return this.getNextCollectorCargo(aps, nD);
    } else if (aps.primaryFunction === "dis")
    {
        return this.getNextDistributorCargo(aps, nD);
    } else if (aps.primaryFunction === "exp")
    {
        return 0;
    } else if (aps.primaryFunction === "bld")
    {
        return this.getNextBuilderCargo(aps, nD);
    }
};
Colony.prototype.getAPSDemand = function (aps)
{
    if (aps.primaryFunction === "col")
    {
        let obj = this.abrMoveables[aps.objectOfInterest];
        return this.getCollectorDemand(aps.objectOfInterest, aps.getCurCapacity(obj));
    } else if (aps.primaryFunction === "dis")
    {
        return this.getDistributorDemand(aps.objectOfInterest);
    } else if (aps.primaryFunction === "exp")
    {
        return [];
    } else if (aps.primaryFunction === "bld")
    {
        return this.getBuilderDemand(aps.objectOfInterest);
    }
};
Colony.prototype.getNextAPSDemand = function (aps, apsDemand)
{
    let nextDemand = [];
    let self = this;
    apsDemand.forEach(function (d) {
        if (d.value > self.balance[d.item]) nextDemand.push({ item: d.item, value: d.value - self.balance[d.item] });
    });
    return nextDemand;
};
Colony.prototype.satisfiesAPSDemand = function (aps, apsDemand)
{
    let satisfaction = true;
    let self = this;
    apsDemand.forEach(function (d) {
        if (self.balance[d.item] < d.value) satisfaction = false;
    });
    return satisfaction;
};
// HIZZZER
Colony.prototype.isHizzzerSource = function (aps)
{
    console.log("Is colony a hizzzer source? Revenue with %s taxation = %s", this.taxation, this.getRevenue(this.taxation));
    return (this.getRevenue(this.taxation) > 100);
};
// COLLECTOR
Colony.prototype.isCollectorSource = function (aps)
{
    let obj = this.abrMoveables[aps.objectOfInterest];
    return (this.balance[obj] > 0);
};
Colony.prototype.getCollectorDemand = function (ooi, curCapacity)
{
    let demand = [];
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] < 0) {
        demand.push({ item: obj, value: (this.balance[obj] * -1)});
    } else
    {
        demand.push({ item: obj, value: curCapacity });
    }
    return demand;
};
Colony.prototype.getCollectorCargo = function (ooi)
{
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] > 0) return this.balance[obj];
    return 0;
};
Colony.prototype.getNextCollectorCargo = function (aps, nD)
{
    let ooi = this.abrMoveables[aps.objectOfInterest];
    if (this.balance[ooi] + aps.ship[ooi] > 0) return this.balance[ooi] + aps.ship[ooi];
    return 0;
};
// BUILDER
Colony.prototype.getBuilderCargo = function (dId, ooi)
{
    let b = this.balance;
    let dC = 0;
    //
    let cSite = autopilot.getColony(dId, true);
    let demand = cSite.getBuilderDemand(ooi);
    //
    if (ooi === "bab" || ooi === "shb")
    {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item];
        });
    } else if (ooi === "stb")
    {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item];
        });
    }
    if (dC > 0) return dC;
    return 0;
};
Colony.prototype.getNextBuilderCargo = function (aps, nD)
{
    if (typeof nD === "undefined") nD = aps.destination;
    let b = this.balance;
    let dC = 0;
    let cSite = autopilot.getColony(nD.id);
    let demand = cSite.getBuilderDemand(aps.objectOfInterest);
    if (aps.objectOfInterest === "bab" || aps.objectOfInterest === "shb")
    {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item] + aps.ship[d.item];
        });
    } else if (aps.objectOfInterest === "stb")
    {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item] + aps.ship[d.item];
        });
    }
    if (dC > 0) return dC;
    return 0;
};
Colony.prototype.getBuilderDemand = function (ooi)
{
    let demand = [];
    let b = this.balance;
    //console.log("Current balance:", b);
    if (ooi === "bab") {
        if (b.duranium < 0) demand.push({ item: "duranium", value: (b.duranium * -1)});
        if (b.tritanium < 0) demand.push({ item: "tritanium", value: (b.tritanium * -1)});
        if (b.molybdenum < 0) demand.push({ item: "molybdenum", value: (b.molybdenum * -1)});
        if (b.megacredits < 0) demand.push({ item: "megacredits", value: (b.megacredits * -1)});
    } else if (ooi === "shb") {
        if (b.duranium < 1500) demand.push({ item: "duranium", value: (1500 - b.duranium)});
        if (b.tritanium < 1000) demand.push({ item: "tritanium", value: (1000 - b.tritanium)});
        if (b.molybdenum < 1500) demand.push({ item: "molybdenum", value: (1500 - b.molybdenum)});
        if (b.megacredits < 10000) demand.push({ item: "megacredits", value: (10000 - b.megacredits)});
    } else if (ooi === "stb") {
        let s = this.structures;
        if (s.factories.def > 0 || s.mines.def > 0 || s.defense.maxNow - s.defense.now > 0)
        {
            let cash = 0;
            let supplies = 0;
            let clans = 0;
            // supplies
            if (s.factories.production - s.factories.def - s.mines.def - (s.defense.maxNow - s.defense.now) < 0)
            {
                if (b.megacredits < parseInt(autopilot.settings.defMcsRetention)) cash += parseInt(autopilot.settings.defMcsRetention) - b.megacredits;
                cash += (s.factories.def * 3) + (s.mines.def * 4) + ((s.defense.maxNow - s.defense.now) * 10);
                if (b.megacredits > 0) cash = 0;
                if (b.supplies < parseInt(autopilot.settings.defSupRetention)) supplies += parseInt(autopilot.settings.defSupRetention) - b.supplies;
                supplies += (s.factories.production - s.factories.def - s.mines.def - (s.defense.maxNow - s.defense.now)) * -1;
                if (b.supplies > 0) supplies = 0;
            }
            // clans
            let clanDef = [];
            if (this.getOptLabor() > this.planet.clans)
            {
                clanDef.push(this.getOptLabor() - this.planet.clans);
            }
            clanDef.sort(function (a, b) {
                return b - a;
            });
            if (clanDef[0] > 0) clans += clanDef[0];
            if (b.clans > 0) clans = 0;
            if (clans > 0) demand.push({ item: "clans", value: clans });
            if (supplies > 0) demand.push({ item: "supplies", value: supplies });
            if (cash > 0) demand.push({ item: "megacredits", value: cash });
        }
    }
    return demand;
};
Colony.prototype.isBuilderSource = function (aps)
{
    let b = this.balance;
    return (
        (aps.objectOfInterest === "bab" && (b.duranium > 0 || b.tritanium > 0 || b.molybdenum > 0 || b.megacredits > 0)) ||
        (aps.objectOfInterest === "stb" && (b.clans > 0 || b.supplies > 0 || b.megacredits > 0)) ||
        (aps.objectOfInterest === "shb" && (b.duranium > 0 || b.tritanium > 0 || b.molybdenum > 0))
    );
};
// DISTRIBUTOR
Colony.prototype.isDistributorSource = function (aps)
{
    let obj = this.abrMoveables[aps.objectOfInterest];
    //console.log("Is Colony distributer source?", (this.balance[obj] > 0));
    return (this.balance[obj] > 0);
};
Colony.prototype.getDistributorCargo = function (ooi)
{
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] > 0) return this.balance[obj];
    return 0;
};
Colony.prototype.getNextDistributorCargo = function (aps, nD)
{
    let obj = this.abrMoveables[aps.objectOfInterest];
    if (this.balance[obj] + aps.ship[obj] > 0) return (this.balance[obj] + aps.ship[obj]);
    return 0;
};
Colony.prototype.getDistributorDemand = function (ooi)
{
    let demand = [];
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] < 0) demand.push({ item: obj, value: (this.balance[obj] * -1)});
    return demand;
};
/*
    INDICATORES
 */
Colony.prototype.drawStarbaseIndicators = function()
{
    let p = this.planet;
    if (autopilot.settings.planetGFX)
    {
        let markup = {
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
    let p = this.planet;
    if (autopilot.settings.planetGFX)
    {
        let markup = {
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
        let withSb = this.hasStarbase;
        if (withSb) {
            let sbFighters = withSb.fighters / 60;
            let sbDefense = withSb.defense / 200;
            let sbBeamTech = withSb.beamtechlevel / 10;
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
    let p = this.planet;
    if (vgap.map.zoom < 7.6 && autopilot.settings.planetGFX)
    {
        let markup = {
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
        let fillCols = {
            neu: "#B22222",
            dur: "#00bfff",
            tri: "#ff8000",
            mol: "#0040ff"
        };
        let allNeu = p.neutronium + p.groundneutronium;
        let allDur = p.duranium + p.groundduranium;
        let allTri = p.tritanium + p.groundtritanium;
        let allMol = p.molybdenum + p.groundmolybdenum;
        let sorted = [
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
        let curFillCol = fillCols[sorted[0].mineral];
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
    let p = this.planet;
    if (p.nativeclans > 0 && p.nativeracename !== "Amorphous" && vgap.map.zoom <= 7.6 && autopilot.settings.planetGFX)
    {
        let markup = {
            attr: {
                stroke: "#FFFFFF",
                lineWidth: 5,
                lineDash: false,
                outline: false,
                outlineStroke: "#FFA500"
            }
        };
        // government = alpha
        let alpha = ((p.nativegovernment / 5) * 0.3);
        // population size = line width
        markup.attr.lineWidth = 5 + Math.ceil(p.nativeclans / 10000);
        // native race = strong circle border, if tec 10 inducer
        if (this.hasTecRace) markup.attr.outline = true;
        autopilot.drawFilledCircle(p.x, p.y, 1.5, markup.attr, null, alpha);
    }
};
Colony.prototype.drawTaxMissionIndicator = function()
{
    let p = this.planet;
    if (vgap.map.zoom > 3)
    {
        let markup = {
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
};
Colony.prototype.drawStructuresIndicator = function()
{
    if (vgap.map.zoom > 5.1 && autopilot.settings.planetGFX) {
        let structures = this.getStructures();
        let maxColPop = this.getMaxColPop();
        let planet = this.planet;
        // STRUCTURES
        //
        // defense
        let markup = {
            attr: {
                stroke: "#FF1493", // deeppink
                lineWidth: 6,
                lineCap: "round",
                lineDash: false
            }
        };
        // let planetDefense = planet.defense / autopilot.getCurrentMaxDefense(planet);
        let planetDefense = planet.defense / structures.defense.maxNow;
        autopilot.drawHorizontalLine(planet.x, planet.y, 1, "se", markup.attr, null, 0.3, 1, 10);
        if (planet.defense > 0) autopilot.drawHorizontalLine(planet.x, planet.y, 1, "se", markup.attr, null, 0.5, planetDefense, 10);
        //
        // factories
        let f = planet.factories;
        let mF = maxColPop;
        let tF = planet.targetfactories;
        let ratioM = f / mF;
        let ratioT = f / tF;
        let ratio = 0;
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
        let m = planet.mines;
        let mM = maxColPop;
        let tM = planet.targetmines;
        let ratio1 = m / mM;
        let ratio2 = m / tM;
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
        let clans = planet.clans;
        ratio = clans / maxColPop;
        markup.attr.lineWidth = 6;
        markup.attr.stroke = "#778899"; // lightslategray
        autopilot.drawHorizontalLine(planet.x, planet.y, 4, "se", markup.attr, null, 0.5, ratio, 10);
        autopilot.drawHorizontalLine(planet.x, planet.y, 4, "se", markup.attr, null, 0.3, 1, 10);
    }
};
Colony.prototype.drawMineralDetailIndicator = function()
{
    if (vgap.map.zoom > 5.1 && autopilot.settings.planetGFX) {
        let planet = this.planet;
        //
        // MINERALS
        let markup = {
            attr: {
                lineWidth: 6,
                lineCap: "butt",
                lineDash: false
            }
        };
        let minCol = {
            neutronium: "#B22222",   // firebrick
            duranium: "#00bfff",
            tritanium: "#ff8000",
            molybdenum: "#0040ff"
        };
        let pos = {
            baseD: 5,
            withinD: 1,
            betweenD: 3
        };
        let minMax = autopilot.mineralMaxis;
        for (let i = 0; i < autopilot.minerals.length; i++) {
            let min = autopilot.minerals[i];
            let gm = "ground" + autopilot.minerals[i];
            let curRatio = planet[min] / minMax[min];
            markup.attr.stroke = minCol[min];
            markup.attr.lineDash = false;
            autopilot.drawVerticalLine(planet.x, planet.y, pos.baseD + (i * pos.betweenD), "ne", markup.attr, null, 0.5, curRatio, 20);
            let curGratio = planet[gm] / minMax.ground[min];
            markup.attr.lineDash = [5, 3]; // [line, space]
            autopilot.drawVerticalLine(planet.x, planet.y, pos.baseD + (i * pos.betweenD) + pos.withinD, "ne", markup.attr, null, 0.3, curGratio, 20);
        }
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

		let buckets = this.buckets;
		(function build() {
			points.forEach(function(point) {
				let key = FRNN.prototype._toKey(point, r);
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
		let i1 = Math.floor(point.x/r);
		let i2 = Math.floor(point.y/r);

		return i1 + "|" + i2;
	};
	/*
     *  return distance between two points
     */
	FRNN.prototype._distance = function(p1, p2)
	{
		return Math.sqrt(Math.pow((p1.x - p2.x),2) + Math.pow((p1.y - p2.y),2));
	};
	/*
     *  return key(s) of (all) neighbor bucket(s)
     */
	FRNN.prototype._getNeighborBuckets = function(bucket)
	{
		let buckets = this.buckets;
		let splitBucket = bucket.split("|");
		let i1 = parseInt(splitBucket[0]);
		let i2 = parseInt(splitBucket[1]);
		//
		let topRight = (i1 + 1) + "|" + (i2 - 1);
		let right = (i1 + 1) + "|" + i2;
		let bottomRight = (i1 + 1) + "|" + (i2 + 1);
		let bottom = i1 + "|" + (i2 + 1);
		let bottomLeft = (i1 - 1) + "|" + (i2 + 1);
		let left = (i1 - 1) + "|" + i2;
		let topLeft = (i1 - 1) + "|" + (i2 - 1);
		let top = i1 + "|" + (i2 - 1);
		//
		let potentials = [topRight, right, bottomRight, bottom, bottomLeft, left, topLeft, top];
		let forwards = [];
		potentials.forEach(function(p) {
			if (p in buckets) forwards.push(p);
		});
		return forwards;
	};
	FRNN.prototype.inRange = function(poi, r, callback, delay, duration)
	{
		// key of poi bucket (point of interest)
		let poiBucket = this._toKey(poi,r);
		// all keys of adjecent buckets
		let neighbors = this._getNeighborBuckets(poiBucket);
		// + key of poi bucket
		neighbors.push(poiBucket);

		// coordinates that are in range...
		let inRange = [];
		let count = 0;

		for (let i=0;i<neighbors.length;i++)
		{
			if (neighbors[i] in this.buckets)
			{
				let curBucket = this.buckets[neighbors[i]];
				for (let j = 0; j < curBucket.length; j++)
				{
					let distance = this._distance(poi, curBucket[j]);
					if (distance <= this.r && distance > 0) // we don't want the coordinate of the poi
					{
						if (typeof callback !== "undefined") callback(poi, curBucket[j], count, delay, duration);
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
            this.useShipNote = setup.useShipNote;
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
        if (typeof this.useShipNote === "undefined") this.useShipNote = true;
        if (typeof this.colScopeRange === "undefined") this.colScopeRange = "auto";
        if (typeof this.colMinCapacity === "undefined") this.colMinCapacity = 0.5;
        if (typeof this.disScopeRange === "undefined") this.disScopeRange = "auto";
        if (typeof this.disMinCapacity === "undefined") this.disMinCapacity = 0.5;
        if (typeof this.minSbFighter === "undefined") this.minSbFighter = 20;
        if (typeof this.minSbDefense === "undefined") this.minSbDefense = 50;
        if (typeof this.defMcsRetention === "undefined") this.defMcsRetention = 50;
        if (typeof this.sbMcsRetention === "undefined") this.sbMcsRetention = 500;
        if (typeof this.defSupRetention === "undefined") this.defSupRetention = 50;
        if (typeof this.sbSupRetention === "undefined") this.sbSupRetention = 500;
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
            useShipNote: this.useShipNote,
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
                        autopilot.getColony(vgap.planetScreen.planet.id, false).update(); // apply (new) orders
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
                                autopilot.getColony(vgap.planetScreen.planet.id, false).update(); // apply (new) orders
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
                shipMission: false,
				ooiOptions: [ "neu", "dur", "tri", "mol", "cla", "mcs", "sup" ],
                action: false,
				hullId: 0
			},
			{
				name: "Distributor",
                nameActive: "<strong>> Distributing</strong>",
				desc: "Distribute resources from sources to sinks.",
				shipFunction: "dis",
                shipMission: false,
				ooiOptions: [ "neu", "cla" ],
                action: false,
				hullId: 0
			},
            {
                name: "Builder",
                nameActive: "<strong>> Building</strong>",
                desc: "Builds starbases (bab), ships (shb) or fighters (fib) and develops planets (stb)",
                shipFunction: "bld",
                shipMission: false,
                ooiOptions: [ "bab", "stb", "shb", "fib" ],
                action: false,
                hullId: 0
            },
			{
				name: "Colonize",
                nameActive: "<strong>> Colonizing</strong>",
				desc: "Colonize unowned planets",
				shipFunction: "exp",
                shipMission: false,
				ooiOptions: [ "slw", "fst" ],
                action: false,
				hullId: 0
			},
            {
                name: "Terraform",
                nameActive: "<strong>> Terraforming</strong>",
                desc: "Terraform planets",
                shipFunction: "ter",
                shipMission: false,
                ooiOptions: [ "cla" ],
                action: false,
                hullId: 0
            },
            {
                name: "Hizzzer",
                nameActive: "<strong>> Hizzzzzing</strong>",
                desc: "MCs Collector using Hizzz",
                shipFunction: "hiz",
                shipMission: 8,
                ooiOptions: [ "mcs" ],
                action: false,
                hullId: 0
            },
            {
                name: "Alchemy",
                nameActive: "<strong>> Brewing</strong>",
                desc: "Load supply and unload minerals",
                shipFunction: "alc",
                shipMission: false,
                ooiOptions: [ "all", "dur", "tri", "mol" ],
                action: false,
                hullId: 105
            },
            {
                name: "Refinery",
                nameActive: "<strong>> Cooking</strong>",
                desc: "Load supply and minerals and unload fuel",
                shipFunction: "alc",
                shipMission: false,
                ooiOptions: [ "neu" ],
                action: false,
                hullId: 104
            },
			{
				name: "Deactivate",
                nameActive: "Deactivate",
				desc: "Deactivate auto-pilot",
				shipFunction: "000",
                shipMission: false,
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
                //
                // ALCHEMY - only show alchemy module if its an alchemy ship
                // REFINERY - only show refinery module if its a refinery ship
                if (c.hullId && vgap.shipScreen.ship.hullid !== c.hullId) continue;
                // TERRAFORM - only show terraform module if its an terraform ship
                if (!vgap.getHull(vgap.shipScreen.ship.hullid).special.match("Terraform Ship") && c.shipFunction === "ter") continue;
                // HIZZZ - only show hizzzer module if it ship has capability
                if ((vgap.player.raceid !== 2 || vgap.shipScreen.ship.beams < 1) && c.shipFunction === "hiz") continue;
                // BUILDER - only show fighter option if the race has capability and the ship has fighter bays
                if (((vgap.player.raceid !== 9 && vgap.player.raceid !== 10 && vgap.player.raceid !== 11) || vgap.shipScreen.ship.bays < 1) && c.shipFunction === "bld") {
                    c.ooiOptions.pop();
                }
                //
                var setShipFunction = function (func, ooiPriority, action, shipMission) {
                    return function () {
                        var oShipMission = vgap.shipScreen.ship.mission;
                        if (shipMission) oShipMission = shipMission;
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
                                    oShipMission: oShipMission,
                                    ooiPriority: ooiPriority
                                };
                                var newAPS = new APSdata(data);
                                autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                            } else {
                                cfgData.newFunction = func;
                                cfgData.newOoiPriority = ooiPriority;
                                autopilot.setupAPS(vgap.shipScreen.ship.id, cfgData); // runs ALL PHASES
                            }
                        }
                        vgap.shipScreen.selectMission(curMission);
                    };
                };
                if (c.ooiOptions.length > 1) {
                    $("<div>" + cName + "<span>" + c.desc + "<br/>Priority: <b id='ooiPriority" + c.shipFunction + "'></b></span></div>").tclick(setShipFunction(false, false, false)).appendTo("#OrdersScreen");
                    for (var j = 0; j < c.ooiOptions.length; j++) {
                        var setShipFunctionOoi = function (func, ooiPriority, shipMission) {
                            return function () {
                                var oShipMission = vgap.shipScreen.ship.mission;
                                if (shipMission) oShipMission = shipMission;
                                var cfgData = autopilot.isInStorage(vgap.shipScreen.ship.id);
                                if (!cfgData) {
                                    var baseId = 0;
                                    var planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                    if (planet) baseId = planet.id;
                                    var data = {
                                        sid: vgap.shipScreen.ship.id,
                                        base: baseId,
                                        shipFunction: func,
                                        oShipMission: oShipMission,
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
                        $("<a style='color:cyan;font-size: 10px;'>" + c.ooiOptions[j] + " </a>").tclick(setShipFunctionOoi(c.shipFunction, c.ooiOptions[j], c.shipMission)).appendTo("#ooiPriority" + c.shipFunction);
                    }
                } else {
                    $("<div>" + cName + "<span>" + c.desc + "</span></div>").tclick(setShipFunction(c.shipFunction, c.ooiOptions[0], c.action, c.shipMission)).appendTo("#OrdersScreen");
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
            stb: "Structures",
            shb: "Ships",
            fib: "Fighter"
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
            mol: "Molybdenum",
            neu: "Fuel"
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
        nupSettings.useShipNote = $( "#sUseNote" ).prop( "checked" );
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

        var checked = "";

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        var a = $("<div id='genSettings'><hr></div>").appendTo(this.pane);
        var ul = $("<ul></ul>").appendTo(a);

        // turn on / off planetary indicators
        var planetGFX = nupSettings.planetGFX;
        $("<li>Display planetary info and indicators: </li>").appendTo(ul);
        var pGFXul = $("<ul></ul>").appendTo(ul);
        if (planetGFX) checked = "checked";
        $("<li><label for='pGFX'>On</label><input type='checkbox' id='pGFX' " + checked + "></li>").appendTo(pGFXul);
        checked = "";

        // turn on / off ship indicators
        var shipGFX = nupSettings.shipGFX;
        $("<li>Display ship indicators: </li>").appendTo(ul);
        var sGFXul = $("<ul></ul>").appendTo(ul);
        if (shipGFX) checked = "checked";
        $("<li><label for='sGFX'>On</label><input type='checkbox' id='sGFX' " + checked + "></li>").appendTo(sGFXul);
        checked = "";

        // turn on / off ship indicators
        var shipUseNote = nupSettings.useShipNote;
        $("<li>Use ship note for mission details: </li>").appendTo(ul);
        var sUseNoteUl = $("<ul></ul>").appendTo(ul);
        if (shipUseNote) checked = "checked";
        $("<li><label for='sUseNote'>On</label><input type='checkbox' id='sUseNote' " + checked + "></li>").appendTo(sUseNoteUl);
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