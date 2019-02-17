/*
    Copyright (C) 2017-2019 Thomas Horn
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
// @version       0.14.29
// @date          2019-02-17
// @author        drgirasol
// @include       http://planets.nu/*
// @include       https://planets.nu/*
// @include       http://play.planets.nu/*
// @include       https://play.planets.nu/*
// @include       http://test.planets.nu/*
// @include       https://test.planets.nu/*
// @supportURL    https://github.com/drgirasol/nupilot/issues
// @homepageURL   https://github.com/drgirasol/nupilot/wiki
// @updateURL     https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.js
// @downloadURL   https://greasyfork.org/scripts/26189-nupilot/code/nuPilot.js
// @grant         none

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
        this.moveablesMap = {
            dur: "duranium",
            tri: "tritanium",
            mol: "molybdenum",
            neu: "neutronium",
            sup: "supplies",
            mcs: "megacredits",
            cla: "clans"
        };
        this.cargo = [
            "duranium",
            "tritanium",
            "molybdenum",
            "supplies",
            "clans"
        ];
        this.moveables = [
            "duranium",
            "tritanium",
            "molybdenum",
            "neutronium",
            "supplies",
            "megacredits",
            "clans"
        ];
        this.noteColor = "ff9900";
        //
        this.ship = ship;
        this.hull = vgap.getHull(ship.hullid);
        this.maxCapacity = false;
        this.curCapacity = false;
        this.minCapacity = false;
        this.demand = false;
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
        this.planet = false; // toDo: planet object contained in colony
        this.colony = false;
        this.isOwnPlanet = false;
        this.isUnownedPlanet = false;
        this.base = false; // base -> planet object
        this.baseColony = false;
        this.atBase = false; // bool
        this.inWarpWell = false; // bool
        this.waypoint = false; // holds planet object if target is a planet
        this.destination = false; // destination -> planet object // toDo: planet object contained in destinationColony
        this.destinationColony = false; // destination -> colony object
        this.secondaryDestination = false; // secondary destination -> planet object // toDo: planet object contained in secondaryDestinationColony
        this.secondaryDestinationColony = false; // secondary destination -> colony object
        this.lastDestination = false; // previous destination
        this.objectOfInterest = false;
        //
        this.enemyPlanets = this.getCloseEnemyPlanets(); // enemy planets within a range of 200 ly
        this.enemyShips = this.getCloseEnemyShips(); // enemy ships within a range of 200 ly
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
            if (!autopilot.apsShips.findById(ship.id)) {
                let newCfg = new APSdata(cfgData);
                autopilot.apsShips.push(newCfg.getData());
            }
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
        console.error("APS.initializeBoardComputer:", this.ship.id);
        this.setPlanet();
        this.setMissionAttributes(configuration);
        this.setShipAttributes(configuration);
        this.setPositionAttributes(configuration);
        //
        // initialize ship function module
        //
        this.bootFunctionModule(configuration.shipFunction);
        this.setFunctionAttributes();
        //
        console.log("...APS:", this);
        //
        if (this.destination) {
            //
            this.setDemand(); console.log("...set demand:", this.demand);
            //
            if (this.planet) {
                console.log("...at planet with destination (" + this.destination.id + ") set.");
                if (this.secondaryDestination) console.log("...and 2ndary destination = " + this.secondaryDestination.id);
                if (this.lastDestination.id === this.planet.id) console.log("...planet is former destination...");
                //
                this.functionModule.handleCargo(this); console.log("...handle cargo.");
                //
                // if we are at the destination, clear destination setting
                if (this.planet.id === this.destination.id && !this.secondaryDestination) {
                    console.log("...planet is destination, update configuration.");
                    if (this.functionModule.missionCompleted(this)) {
                        console.log("...mission completed, update configuration.");
                        configuration.lastDestination = this.destination.id;
                        configuration.destination = false;
                        configuration.secondaryDestination = false;
                        configuration.idle = false;
                        configuration.idleReason = "";
                        configuration.idleTurns = 0;
                        // if new behaviour is requested, now is the time for change
                        if (configuration.newFunction) {
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
                        console.log("...mission incomplete! Due for mission update.");
                        this.functionModule.setSecondaryDestination(this);
                        if (this.secondaryDestination || this.planet.id !== this.destination.id) {
                            console.log("...setting next Target.");
                            this.setShipTarget();
                        }
                    }
                } else if (this.secondaryDestination && this.planet.id === this.secondaryDestination.id)
                {
                    console.log("...planet is 2ndary destination, update configuration.");
                    configuration.lastDestination = this.secondaryDestination.id;
                    configuration.secondaryDestination = false;
                    if (configuration.shipFunction === "exp" && this.planet.id !== this.base.id) {
                        this.hasToSetPotDes = true; // expander will set new destination after re-supplying, if it didn't return to base
                    } else {
                        this.setMissionAttributes(configuration);
                        console.log("...setting next Target.");
                        this.setShipTarget();
                    }
                } else if (!this.destination) {
                    // seems destination was reset, we need to find a new one
                    console.warn("...destination was reset by handleCargo.");
                    this.hasToSetPotDes = true;
                } else {
                    console.log("...planet is no destination.");
                    if (this.getMissionConflict(this.destination)) {
                        console.warn("...Mission conflict! Scheduled for potential destination determination.");
                        this.hasToSetPotDes = true;
                    } else {
                        console.log("...setting next Target.");
                        this.setShipTarget();
                    }
                }
                //this.storedData = autopilot.syncLocalApsStorage(configuration);
            } else {
                if (this.getMissionConflict(this.destination)) {
                    if (this.ship.target && this.destination.id === this.ship.target.id) {
                        console.warn("...Mission conflict! Scheduled for potential destination determination.");
                        this.hasToSetPotDes = true;
                    } else {
                        console.warn("...Mission conflict! Proceed to target planet and re-check mission conflict.");
                    }
                } else
                {
                    console.log("...in space / warp-well with destination / secondary destination set.", this.destination, this.secondaryDestination);
                    if (!this.targetIsSet()) this.setShipTarget();
                    if (this.targetIsSet())
                    {
                        // target set
                        let wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
                        if (wpP) this.waypoint = wpP;
                    } else {
                        // no target is set...
                        console.error("...setting next Target failed.");
                        //this.setShipTarget();
                    }
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
    APS.prototype.setPlanet = function() {
        //console.log("APS.setPlanet:");
        let self = this;
        let p = vgap.planetAt(this.ship.x, this.ship.y);
        //console.log("...planet", p);
        if (p) {
            this.planet = new Proxy(p, {
                set: function(target, prop, value, receiver) {
                    if (self.moveables.indexOf(prop) > -1) {
                        console.log("APS.planet proxy: update balance");
                        let c = autopilot.getColony(target.id, true); // update balance
                    }
                    target[prop] = value;
                    return true;
                }
            });
            this.colony = autopilot.getColony(p.id, true);
        } else {
            this.planet = false;
            this.colony = false;
        }
    };
    APS.prototype.setShipIdleStatus = function(cfg) {
        this.isIdle = cfg.isIdle;
        if (!cfg.idleReason) {
            this.idleReason = [];
        } else if (cfg.idleReason && this.idleReason.indexOf(cfg.idleReason) === -1) this.idleReason.push(cfg.idleReason);
        if (cfg.idleTurns) this.idleTurns = cfg.idleTurns;
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

        //if (this.inWarpWell) this.planet = false;
        this.setConventionalShipMission(cfg);
        this.setRange();
    };
    APS.prototype.setRange = function()
    {
        this.simpleRange = Math.pow(this.ship.engineid, 2); // max turn distance with max efficient warp (=engineid)
        if (this.gravitonic) this.simpleRange *= 2;
    };
    APS.prototype.setConventionalShipMission = function(cfg) {
        this.oShipMission = cfg.oShipMission;
        if (this.oShipMission && this.oShipMission !== this.ship.mission) {
            if (this.ship.mission !== 9 && this.ship.mission !== 8 && this.ship.mission !== 2 && this.ship.mission !== 1) {
                this.ship.mission = this.oShipMission;
            } //
        } // reset to original ship mission, if we are not cloaking, hizzing (or other mission 8), laying or sweeping mines
    };
    APS.prototype.setPositionAttributes = function(cfg) {
        //this.scopeRange = 200; // set by function module!
        //if (!this.inWarpWell) this.planet = vgap.planetAt(this.ship.x, this.ship.y);
        if (!this.planet) this.inWarpWell = this.isInWarpWell( { x: this.ship.x, y: this.ship.y } );
        this.isOwnPlanet = (this.planet && this.planet.ownerid === vgap.player.id);
        this.isUnownedPlanet = (this.planet && this.planet.ownerid === 0);
        this.base = vgap.getPlanet(cfg.base);
        this.baseColony = autopilot.getColony(cfg.base, true);
        if (this.planet && this.planet.id === this.base.id) this.atBase = true; // are we at our base of operation
    };
    APS.prototype.setMissionAttributes = function(cfg)
    {
        console.log("APS.setMissionAttributes:");
        this.primaryFunction = cfg.shipFunction;
        if (this.primaryFunction === "hiz" && this.planet && autopilot.hizzzerPlanets.indexOf(this.planet.id) === -1) autopilot.hizzzerPlanets.push(this.planet.id);
        this.objectOfInterest = cfg.ooiPriority;
        console.log("...cfg.destination:", cfg.destination);
        if (cfg.destination && !this.destination) {
            console.log("...setting destination", cfg.destination);
            this.destination = vgap.getPlanet(cfg.destination);
            this.destinationColony = autopilot.getColony(cfg.destination, true);
            this.setDemand(); console.log("...set demand:", this.demand);
        } else if (!cfg.destination) {
            console.log("...setting destination", false);
            this.destination = false;
            this.destinationColony = false;
            this.demand = false;
        }
        if (this.destination && !this.isValidDestination(this.destination.id)) {
            console.log("...invalidating destination", this.destination.id);
            this.destination = false;
            this.destinationColony = false;
            this.demand = false;
        } // e.g. is destination (still) our planet
        if (cfg.secondaryDestination) {
            this.secondaryDestination = vgap.getPlanet(cfg.secondaryDestination);
            this.secondaryDestinationColony = autopilot.getColony(cfg.secondaryDestination, true);
        }
        if (cfg.secondaryDestination === false || (this.secondaryDestination && !this.isValidDestination(this.secondaryDestination.id))) {
            this.secondaryDestination = false;
            this.secondaryDestinationColony = false;
        } // e.g. is destination (still) our planet
        if (this.destination && this.secondaryDestination && this.destination.id === this.secondaryDestination.id) {
            this.secondaryDestination = false;
            this.secondaryDestinationColony = false;
        } // toDo: should not happen, but did happen
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
    APS.prototype.setDestination = function(dC) {
        if (dC) {
            this.destinationColony = dC;
            this.destination = dC.planet;
            this.setDemand();
        } else {
            this.destinationColony = false;
            this.destination = false;
            this.demand = false;
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
    APS.prototype.getCurCapacity = function(object) {
        if (typeof object === "undefined") object = "other";
        if (object === "neutronium" || object === "fuel" || object === "neu") return this.getFuelCapacity();
        if (object === "megacredits" || object === "cash" || object === "mcs") return (10000-this.ship.megacredits);
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
    APS.prototype.isAPSbase = function(pid)
    {
        return (autopilot.apsShips.getBaseIdx().indexOf(pid) > -1);
    };
    APS.prototype.destinationHasSameAPStype = function(pid, sf, ooi, secondary)
    {
        if (typeof sf === "undefined") sf = this.primaryFunction;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        if (typeof secondary === "undefined") secondary = false;
        let pool = [];
        if (secondary) {
            pool = autopilot.apsShips.findBySecondaryDestination(pid);
        } else {
            pool = autopilot.apsShips.findByDestination(pid);
        }
        if (pool.length > 0) {
            let conflictAPS = [];
            let self = this;
            pool.forEach(function (aps) {
                if (aps.sid !== self.ship.id && aps.shipFunction === sf) {
                    if (aps.ooiPriority === ooi || aps.shipFunction === "exp") conflictAPS.push(aps);
                }
            });
            if (conflictAPS.length > 0) {
                console.log("APS.destinationHasSameAPStype: %s", pid, conflictAPS);
                return conflictAPS;
            }
        }
        return false;
    };
    APS.prototype.baseHasSameAPStype = function(pid, sf, ooi) {
        if (typeof sf === "undefined") sf = this.primaryFunction;
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        let apsByBase = autopilot.apsShips.findByPlanet(pid);
        if (apsByBase.length > 0) {
            for (let i = 0; i < apsByBase.length; i++) {
                if (apsByBase[i].sid === this.ship.id) continue;
                if (apsByBase[i].shipFunction === sf && apsByBase[i].ooiPriority === ooi) return true;
            }
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
            if (autopilot.shipIsArmed(eS[j]))
            {
                // check if object is farther away from enemy than current location
                let objectEnemyDist = Math.ceil(autopilot.getDistance( object, eS[j] ));
                let apsEnemyDist = Math.ceil(autopilot.getDistance( this.ship, eS[j] ));
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
        console.log("APS.isInWarpWell:");
        if (typeof coords === "undefined") coords = { x: this.ship.x, y: this.ship.y };
        let planet = vgap.planetAt(coords.x, coords.y);
        if (planet) return false; // if we are at planet, we are not in warp well
        let cP = autopilot.getClosestPlanet(coords, 1, true);
        if (cP)
        {
            return autopilot.positionIsInWarpWellOfPlanet(cP.planet, coords);
        } else {
            console.error("...no closest planet found???");
            return false;
        }
    };
    APS.prototype.shipTargetInWarpWell = function()
    {
        console.log("APS.shipTargetInWarpWell:");
        let s = this.ship;
        let planet = vgap.planetAt(s.targetx, s.targety);
        if (planet) return false; // target is planet
        let cP = autopilot.getClosestPlanet(s, 1, true);
        if (cP) {
            return autopilot.positionIsInWarpWellOfPlanet(cP.planet, s);
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
                    closeEnemyPlanets[idx].distance = Math.floor(autopilot.getDistance( s, eP ));
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
                    closeEnemyShips[idx].distance = Math.floor(autopilot.getDistance( s, eP ));
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
        let curDistance = Math.ceil(autopilot.getDistance(tP, this.ship));
        let thisFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, [], curDistance); // [] = current cargo
        if (this.ship.hullid === 96) thisFuel -= (2 * (curDistance - 1)); // cobol ramscoop
        let nextMissionTarget = false;
        let nextCargo = [];
        if (this.destination.id === tP.id || (this.secondaryDestination && this.secondaryDestination.id === tP.id)) {
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
                let distance = Math.ceil(autopilot.getDistance(tP, nWP));
                nextFuel = autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, nextCargo, distance);
                if (this.ship.hullid === 96) nextFuel -= (2 * (distance-1)); // cobol ramscoop
            }
        }
        if (!nextFuel) return thisFuel; // as precaution, if no next fuel could be determined, return consumption of prior (this) trip
        return nextFuel;
    };
    APS.prototype.checkFuel = function(cargo) {
        console.log("APS.checkFuel:");
        //if (typeof this.planet === "undefined") return true;
        if (typeof cargo === "undefined") cargo = [];
        this.setWarp(); // set warp factor according to current circumstances
        let fuel = Math.ceil(autopilot.getOptimalFuelConsumptionEstimate(this.ship.id, cargo));
        console.log("...need %d fuel for journey!", fuel);
        if (!fuel) return false;
        //  toDo: export to own function or merge with estimateNextFuelConsumption
        let tP = vgap.planetAt(this.ship.targetx, this.ship.targety);
        if (tP) {
            let nextFuel = 0;
            if (tP.neutronium > -1) { // ownPlanet
                nextFuel = this.estimateNextFuelConsumption(tP);
                //console.log("...required fuel at next waypoint: " + nextFuel);
                if (nextFuel > tP.neutronium) {
                    fuel += (nextFuel - tP.neutronium);
                    console.log("...need additional %d fuel for journey!", nextFuel - tP.neutronium);
                }
            } else { // unowned planet (currently this means expander)
                fuel += fuel; // provide basic fuel backup for (empty) return trip from unowned planet..
                console.log("...need additional %d fuel for journey (unowned planet)!", fuel);
            }
        }
        //
        //
        let diff = fuel - this.ship.neutronium;
        console.log("...including onboard fuel, we need %d additional fuel.", diff);
        if (diff <= 0) return true; // if there is enough, we don't need to load fuel
        // else, try to load
        let loadedFuel = 0;
        if (this.colony && this.colony.isOwnPlanet) { // only load if we are in orbit around one of our planets
            this.loadObject("fuel", this.planet, diff); // loading "FUEL" overwrites balance limitation (in contrast to "neutronium"), returns amount on board after loading
        } else if (this.colony && !this.colony.isOwnPlanet) {
            if (this.ship.mission !== 10) this.ship.mission = 10; // we set the ship mission to "beam up fuel"
            // toDo: towing is not yet part of any APS activity, if this should change,
            // toDo: this needs to be thought through: we would need to store the fact, that the ship actually was towing (storage.formerShipMission)
        } else {
            // we are in space // toDo: can we transfer fuel from another ship?
        }
        //
        // after loading, there is enough! OR if gather neutronium will be enough... OR hull = 14 (Neutronic Fuel Carrier)
        // OR target planet has enough...
        if (this.ship.neutronium >= fuel ||
            (this.planet && this.ship.mission === 10 && this.ship.neutronium + this.planet.neutronium >= fuel) ||
            this.ship.hullid === 14) {
            return true;
        } else {
            if (this.colony) this.setWarp(0);
            return false;
        }
    };
    APS.prototype.setWarp = function(warp)
    {
        console.log("APS.setWarp:");
        this.ship.warp = 0;
        if (typeof warp === "undefined") {
            this.ship.warp = this.ship.engineid;
        } else {
            this.ship.warp = warp;
        }
        if (this.targetIsSet()) {
            // if target is reachable within one turn set warp to mininum speed required
            if (this.ship.warp > 0 && (!this.planet && this.ship.target) || (this.planet && this.ship.target && this.ship.target.id !== this.planet.id)) {
                let distance = autopilot.getDistance(this.ship, this.ship.target);
                console.log("...trying to adjust warp speed for distance", distance);
                let eta = Math.ceil(autopilot.getDistance(this.ship, this.ship.target) / Math.pow(this.ship.warp, 2));
                console.log("...eta with current warp:", eta, this.ship.warp);
                if (eta === 1 && this.ship.warp > 1) {
                    while (eta === 1 && this.ship.warp > 1) {
                        this.ship.warp -= 1;
                        eta = Math.ceil(autopilot.getDistance(this.ship, this.ship.target) / Math.pow(this.ship.warp, 2));
                        console.log("...eta with adjusted warp:", eta, this.ship.warp);
                    }
                    if (eta > 1) {
                        this.ship.warp += 1;
                    }
                }
            } else {
                console.log("...ship.target:", this.ship.target);
            }
            // reduce speed to warp 4, if we are currently inside a minefield
            if (autopilot.objectInsideEnemyMineField( {x: this.ship.x, y: this.ship.y} ).length > 0 && this.ship.engineid > 4) this.ship.warp = 4;
            // reduce speed to warp 3, if we are currently inside a web minefield
            if (autopilot.objectInsideEnemyWebMineField( {x: this.ship.x, y: this.ship.y} ).length > 0 && this.ship.engineid > 3) this.ship.warp = 3;
            // set warp 1 if we are moving into or inside warp well
            if (this.shipTargetInWarpWell()) this.ship.warp = 1;
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
            console.log("APS.escapeToWarpWell: We are in warp well...");
            this.isIdle = true;
            // toDo: do we have to move? are there enemy ships close by?
        } else {
            console.log("APS.escapeToWarpWell: Moving into warp well...");
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
    APS.prototype.setShipTarget = function() {
        console.log("APS.setShipTarget:");
        let dP = this.destination;
        if (this.secondaryDestination) dP = this.secondaryDestination;
        if (this.planet && dP.id === this.planet.id) {
            if (this.secondaryDestination) {
                this.secondaryDestination = false;
                this.secondaryDestinationColony = false;
                dP = this.destination;
            } else {
                return true;
            }
        } // toDo: What to do?
        console.log("...searching waypoints to " + dP.name + " (" + dP.id + ").");
        this.setWaypoints(this.ship, dP);
        let potWpIds = this.potentialWaypoints.map(function (pWp) {
            return pWp.id;
        });
        console.log("...potWpIds:", potWpIds, this.ship.target);
        if (this.ship.target && potWpIds.indexOf(this.ship.target.id) > -1) return true; // is target is already set and a potential Waypoint, do not set another

        let target = this.getNextWaypoint(dP);
        if (target) {
            console.log("...fly to " + target.id);
            this.ship.targetx = target.x;
            this.ship.targety = target.y;
            let wpP = vgap.planetAt(this.ship.targetx, this.ship.targety);
            if (wpP) this.waypoint = wpP;
            return true;
        } else {
            return false;
        }
    };
    /*
     *  WAYPOINTS
     */
    APS.prototype.setWaypoints = function(ship, dP)
    {
        console.log("APS.setWaypoints:");
        // toDo: warpwell minimum distance used, how to implement heading consideration (warpwell max dist = 3)
        this.functionModule.setPotentialWaypoints(this); // set the initial pool of potential waypoints specific for the current function (e.g. frnnOwnPlanets)
        let ship2dest = this.getDistance(dP, false);
        let waypoints = autopilot.getTargetsInRange(this.potentialWaypoints, dP.x, dP.y, ship2dest); // targets within a range of destination->current position
        let wpPlanets = waypoints.map(function (p) {
            return vgap.getPlanet(p.id);
        });
        wpPlanets.push(dP); // including destination planet
        let safeWaypoints = wpPlanets.filter(function (p) {
            let c = autopilot.getColony(p.id);
            return c.determineSafety();
        });
        console.log("...safe waypoints:", safeWaypoints);
        let eta2dest = Math.ceil(ship2dest / Math.pow(this.ship.engineid, 2));
        let fWPs = [];
        let self = this;
        safeWaypoints.forEach(function (p, idx) {
            let dist2Planet = self.getDistance(p, false); // aps-planet
            let eta2Planet = Math.ceil(dist2Planet / Math.pow(self.ship.engineid, 2));
            if (eta2Planet === 1 || eta2Planet <= eta2dest) { // skip waypoints that are significantly further away
                let pW2dPDist = autopilot.getDistance( p, dP, false );
                safeWaypoints[idx].ship2wPDist = dist2Planet;
                safeWaypoints[idx].wayp2dPDist = pW2dPDist;
                safeWaypoints[idx].ship2dPDist = ship2dest;
                safeWaypoints[idx].ship2wP2dPDist = dist2Planet + pW2dPDist;
                safeWaypoints[idx].wpETA = Math.ceil(dist2Planet / Math.pow(self.ship.engineid, 2)) + Math.ceil(pW2dPDist / Math.pow(self.ship.engineid, 2)); // ETA if using pW as next stop
                fWPs.push(p);
            }
        });
        this.potentialWaypoints = fWPs;
        console.log("...this.potentialWaypoints:", this.potentialWaypoints);
    };
    APS.prototype.getNextWaypoint = function(dP, cP, notDP)
    {
        console.log("APS.getNextWaypoint:");
        if (typeof notDP === "undefined") notDP = false;
        if ((typeof cP === "undefined" || cP === null) && this.planet) cP = this.planet;
        if ((typeof cP === "undefined" || cP === null) && !this.planet) cP = this.ship;
        let target = false;
        let closeToEnemy = (this.enemyShips || this.enemyPlanets); // use "safe" planet hopping if we are close to enemy territory
        let relativelySafe = false;
        let urgendWaypoint = this.getUrgentWaypoint(dP, cP);
        console.log("...urgendWaypoint:", urgendWaypoint);
        let pathWithinOwnMinefield = false;
        let pathWithinEnemyMinefield = false;
        let pathCloseToEnemy = false;
        if (urgendWaypoint) {
            // check if next turn position is covered by a friendly minefield
            let originalX = this.ship.targetx;
            let originalY = this.ship.targety;
            this.ship.targetx = urgendWaypoint.x;
            this.ship.targety = urgendWaypoint.y;
            let path = vgap.getPath(this.ship);
            let wps = Math.floor(Object.keys(path).length / 2);
            for (let i = 1; i < wps; i++) {
                let obj = { x: path["x" + i], y: path["y" + i] };
                if (!autopilot.objectInside(obj, autopilot.frnnFriendlyMinefields)) pathWithinOwnMinefield = false;
                if (autopilot.objectInside(obj, autopilot.frnnEnemyMinefields)) pathWithinEnemyMinefield = true;
                if (autopilot.objectCloseTo(obj, [].concat(autopilot.frnnEnemyPlanets, autopilot.frnnEnemyShips), 82)) pathCloseToEnemy = true;
            }
            this.ship.targetx = originalX;
            this.ship.targety = originalY;
        }
        if (urgendWaypoint && !pathWithinEnemyMinefield && (!pathCloseToEnemy || (pathCloseToEnemy && pathWithinOwnMinefield)) && !notDP) {
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
        let dDist = autopilot.getDistance( origin, dP, false );
        let dETA = Math.ceil(dDist / Math.pow(this.ship.engineid, 2));
        //console.log("...direct ETA: " + dETA + " (" + dDist + ")");
        let uWPs = [];
        for (let i = 0; i < waypoints.length; i++) {
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
        console.log("APS.getWaypointsByEta:");
        if (typeof origin === "undefined") origin = this.ship;
        if (typeof not === "undefined") not = []; // planet ids to exclude
        if (this.potentialWaypoints.length === 0) this.setWaypoints(origin, dP); // ensure potential waypoints have been set
        let waypoints = this.potentialWaypoints;
        let self = this;
        let ETAs = [...new Set(waypoints.map(function (p) {
            return Math.ceil(p.ship2wPDist / Math.pow(self.ship.engineid, 2));
        }))];
        ETAs.sort(function (a, b) {
            return a - b;
        });
        console.log("...ETAs:", ETAs);
        let wpByEta = {};
        ETAs.forEach(function (eta) {
            wpByEta[eta] = waypoints.filter(function (p) {
                return Math.ceil(p.ship2wPDist / Math.pow(self.ship.engineid, 2)) === eta && not.indexOf(p.id) === -1;
            });
            wpByEta[eta].sort(function (a, b) {
                return a.wayp2dPDist - b.wayp2dPDist;
            });
        });
        console.log("...wpByEta:", wpByEta);
        return wpByEta;
    };
    APS.prototype.getEtaWaypoint = function(dP, origin, notDP)
    {
        console.log("APS.getEtaWaypoint:");
        if (dP)
        if (typeof notDP === "undefined") notDP = false;
        if (typeof origin === "undefined" || origin === null) origin = this.ship;
        let not = []; // planet ids to exclude
        let waypoints = this.getWaypointsByEta(dP, origin, not);
        let ETAs = Object.keys(waypoints);
        let target = false;
        let minETA = ETAs[0];
        let self = this;
        ETAs.forEach(function (eta) {
            console.log("...potential waypoints with ETA %s:", eta, waypoints[eta]);
            if (eta === minETA) {
                if (!notDP && self.destinationAmongWaypoints(dP, waypoints[eta]) && self.shipPathIsSave(dP)) {
                    console.log("...potential waypoints contain destination!");
                    target = dP;
                }
            }
            if (!target) {
                waypoints[eta].forEach(function (wp) {
                    if (!target)
                    {
                        if (notDP && wp.id === dP.id) {
                            // dP is not allowed to be a waypoint
                        } else if (autopilot.positionIsInWarpWellOfPlanet(wp, self.ship))
                        {
                            console.log("...return in orbit of " + wp.id);
                            target = wp;
                        } else if (self.shipPathIsSave(wp))
                        {
                            target = wp;
                        }
                    }
                });
            }
        });
        console.log("...ETA target:", target);
        return target;
    };
    APS.prototype.thereIsACloserWaypoint = function(cWp)
    {
        console.log("APS.thereIsACloserWaypoint:");
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
    APS.prototype.thereIsACloserPlanetWithEnoughFuel = function(cWp) { // toDo: !!!
        console.log("APS.thereIsACloserPlanetWithEnoughFuel:", cWp);
        this.setWaypoints(this.ship, cWp);
        if (this.potentialWaypoints.length > 0) {
            this.potentialWaypoints.sort(function (a, b) {
                return a.ship2wPDist - b.ship2wPDist;
            });
            let curPweF = this.potentialWaypoints.shift();
            while (this.potentialWaypoints.length > 0 && curPweF.neutronium < 50) {
                curPweF = this.potentialWaypoints.shift();
            }
            console.log("...close waypoint with enough fuel:", curPweF);
            if (curPweF.neutronium >= 50) {
                this.ship.targetx = curPweF.x;
                this.ship.targety = curPweF.y;
                this.waypoint = curPweF;
                return this.checkFuel();
            }
        }
        return false;
    };
    /*
     *  GENERAL TOOLS
     */
    APS.prototype.getDistance = function(obj, exact) {
        return autopilot.getDistance( this.ship, obj, exact );
    };
    APS.prototype.updateNote = function() {
        let note = vgap.getNote(this.ship.id, 2);
        if (note) note.body = "";
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
        if (this.shipFunction === "col" || this.shipFunction === "hiz")
        {
            center = { x: this.base.x, y: this.base.y };
        } else
        {
            center = { x: this.ship.x, y: this.ship.y };
        }
        let lStorage = autopilot.loadLocalApsData();
        if (lStorage) {
            let frnnPositions = [];
            let pids = [];
            let sids = [];
            for(let i = 0; i < lStorage.length; i++) {
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
    APS.prototype.evaluateMissionDestinations = function() {
        // function module specific filtering of potential destinations
        this.functionModule.validateMissionDestinations(this);
        // general filtering of potential destinations (e.g. remove destinations located in problematic zones)
        let self = this;
        let filteredDest = this.potDest.filter(function (c) { // base planet, colonies without mission conflict and safe to approach
            return (!self.getMissionConflict(c.planet)) && c.determineSafety();
        });
        let avoidDest = this.potDest.filter(function (c) {
            return !c.determineSafety();
        });
        console.log("APS.evaluateMissionDestinations: Valid destinations = %s, avoided = %s", filteredDest.length, avoidDest.length);
        if (avoidDest.length > 0) {
            if (filteredDest.length > 0) {
                console.log("...appending avoided-destinations");
                filteredDest.concat(avoidDest);
            } else {
                console.log("...using avoided-destinations only");
                filteredDest = avoidDest;
            }
        }
        this.potDest = filteredDest;
    };
    APS.prototype.setMissionDestination = function() {
        console.log("APS.setMissionDestination:");
        if (this.destination) this.lastDestination = this.destination;
        this.destination = false;
        this.destinationColony = false;
        this.demand = false;
        //
        if (this.potDest.length > 0) {
            this.evaluateMissionDestinations();
            if (this.potDest.length > 0) {
                this.setDestination(this.potDest[0]);
                console.log("...mission destination: ", this.destination.id);
                if (!this.colony.isOwnPlanet && this.primaryFunction === "exp") this.functionModule.handleCargo(this);
                // if no secondary destination is set, check if one is necessary
                if (!this.secondaryDestination) this.functionModule.setSecondaryDestination(this);
                //
                if (this.setShipTarget()) {
                    this.setWarp();
                } else {
                    this.setShipIdleStatus( { isIdle: true, idleReason: "waypoint", idleTurns: 0 } );
                }
            }
        }
        if (this.destination === false) {
            if (this.planet && this.planet.id !== this.base.id) {
                console.warn("...ship returning to base! => no destination acquired");
                this.setDestination(this.baseColony);
            } else { // idle
                console.warn("...ship idle! => no destination acquired");
                this.ship.targetx = this.ship.x;
                this.ship.targety = this.ship.y;
                this.setShipIdleStatus( { isIdle: true, idleReason: "dest", idleTurns: 0 } );
            }
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
    APS.prototype.considerFuelStatus = function() {
        if (this.checkFuel()) {
            console.log("...checkFuel ok.");
            this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: false } );
        } else {
            this.setShipIdleStatus( { isIdle: true, idleReason: "fuel", idleTurns: 0 } );
            console.warn("...checkfuel failed.");
            if (this.waypoint && this.thereIsACloserWaypoint(this.waypoint)) {
                // true = we can reach another possible waypoint with the available fuel
                console.info("...but we can reach another waypoint.");
                this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
            } else if (this.thereIsACloserPlanetWithEnoughFuel(this.waypoint)) {
                // true = a planet closer to the current position and farther away from the destination / actual waypoint with enough fuel
                // to support the travel to the actual waypoint can be approached
                console.info("...but we can reach another planet with enough fuel.");
                this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
            } else if (this.planet && this.getCargoCapacity() !== this.hull.cargo && this.reduceCargoToProceed() && this.primaryFunction !== "exp") {
                // true = reduction of cargo helped to continue
                // this can be limited to a certain degree (maximum reduction, wait at least one turn or not)
                console.info("...but we can reach target with reduced cargo.");
                this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
            } else {
                console.warn("...are we in warpwell? " + this.inWarpWell);
                if (this.inWarpWell) {
                    // try returning to planet
                    let cP = autopilot.getClosestPlanet({ x: this.ship.x, y: this.ship.y }, 1, true);
                    console.warn("...in warpwell around " + cP.planet.id);
                    if (cP) {
                        this.ship.targetx = cP.planet.x;
                        this.ship.targety = cP.planet.y;
                        console.warn("...approaching standard orbit.");
                        this.setWarp();
                        this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
                    }
                }
                if (this.planet) {
                    let cC = autopilot.getColony(this.planet.id);
                    if (!cC.determineSafety()) {
                        this.escapeToWarpWell();
                        this.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
                    }
                } else {
                    // in space
                    console.warn("...idle in space!");
                }
            }
        }
    };
    APS.prototype.confirmMission = function() {
        console.log("APS.confirmMission:");
        if (this.destination) {
            if (this.planet && this.isOwnPlanet) {
                console.log("...handle cargo");
                this.functionModule.handleCargo(this);
            }
            this.functionModule.confirmMission(this);
            // Do we have a target?
            if (this.targetIsSet()) {
                console.log("...target acquired.");
                this.considerFuelStatus();
            } else {
                // target not set!
                if (this.planet) {
                    if (this.destination.id !== this.planet.id) {
                        console.warn("...no target acquired (idle).");
                        this.setShipIdleStatus( { isIdle: true, idleReason: "target", idleTurns: 0 } );
                        let cC = autopilot.getColony(this.planet.id);
                        if (!cC.determineSafety()) {
                            this.escapeToWarpWell();
                            this.setShipIdleStatus( { isIdle: true, idleReason: "danger", idleTurns: 0 } );
                        }
                    } else {
                        if (this.ship.neutronium < 1) { // make sure fuel is aboard, except for merlin alchemy // toDo: ???
                            if (this.ship.hullid !== 105) {
                                if  (this.planet.neutronium > 0) {
                                    this.loadObject("fuel", this.planet, 1);
                                } else {
                                    this.setShipIdleStatus( { isIdle: true, idleReason: "fuel", idleTurns: 0 } );
                                }
                            }
                        }
                        if (this.primaryFunction === "alc" || this.primaryFunction === "ter" || this.primaryFunction === "hiz" || (this.primaryFunction === "bld" && this.objectOfInterest === "fib")) {
                            // mission probably not yet completed
                        } else {
                            this.setShipIdleStatus( { isIdle: true, idleReason: "dest", idleTurns: 0 } );
                        }
                    }
                } else {
                    this.setShipIdleStatus( { isIdle: true, idleReason: "unknown", idleTurns: 0 } );
                }
            }
            this.updateStoredData();
            this.updateNote();
        }
        //
    };
    APS.prototype.getMissionConflict = function(potPlanet) {
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
    APS.prototype.setDemand = function () { // demand = what we need and don't have aboard
        let dC = autopilot.getColony(this.destination.id);
        dC.updateBalance(false);
        this.demand = dC.getAPSDemand(this);
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
    APS.prototype.unload = function(ooi) {
        if (typeof ooi === "undefined") ooi = this.objectOfInterest;
        if (ooi === "bab" || ooi === "shb" || ooi === "all") { // builder / alchemist (all)
            this.unloadCargo(["duranium", "tritanium", "molybdenum"]);
            this.unloadMegacredits();
        } else if (ooi === "fst" || ooi === "slw") { // expander
            this.functionModule.transferCargo(this);
        } else {
            if (ooi === "mcs") this.unloadMegacredits();
            if (ooi === "neu") this.unloadFuel();
            if (ooi !== "mcs" && ooi !== "neu") this.unloadCargo([this.moveablesMap[ooi]]);
        }
    };
    APS.prototype.unloadAll = function() {
        this.unloadCargo();
        this.unloadMegacredits();
        this.unloadFuel();
    };
    APS.prototype.unloadFuel = function() {
        console.log("APS.unloadFuel:");
        let unloaded = 0;
        if (this.planet && this.isOwnPlanet) {
            let amount = parseInt(this.ship.neutronium);
            if (amount > 1 && this.shipFunction !== "alc") amount -= 1; // leave 1 neutronium on board
            unloaded = this.unloadObject("neutronium", this.planet, amount);
            console.log("...unloaded:", unloaded);
        }
    };
    APS.prototype.unloadMegacredits = function() {
        console.log("APS.unloadMegacredits:");
        let unloaded = 0;
        if (this.planet && this.isOwnPlanet) {
            unloaded += this.unloadObject("megacredits", this.planet, parseInt(this.ship.megacredits));
            console.log("...unloaded:", unloaded);
            let c = autopilot.getColony(this.planet.id, true);
            c.update(true);
        }
    };
    APS.prototype.unloadCargo = function(cargo) {
        console.log("APS.unloadCargo:");
        if (typeof cargo === "undefined") cargo = this.cargo;
        let unloaded = 0;
        let self = this;
        if (this.planet && this.isOwnPlanet) {
            cargo.forEach(function (obj) {
                if (obj !== "neutronium") unloaded += self.unloadObject(obj, self.planet, parseInt(self.ship[obj]));
            });
            console.log("...unloaded:", unloaded);
            let c = autopilot.getColony(this.planet.id, true);
            c.update(true);
        }
    };
    APS.prototype.unloadObject = function(object, to, amount)
    {
        if (typeof amount === "undefined") amount = this.ship[object];
        if (amount > 0) {
            console.log("APS.unloadObject:", object, amount);
            // ...amount is more than what is available, then only unload the latter amount
            if (amount > this.ship[object]) amount = this.ship[object];
            // now unload, planets have unlimited cpacity... no need to check
            this.ship[object] -= amount;
            to[object] += amount;
            to.changed = 1;
            let c = autopilot.getColony(to.id, true);
            return amount;
        } else {
            return 0;
        }

    };
    APS.prototype.transferObject = function(object, to, amount)
    {
        console.log("APS.transferObject:");
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
    APS.prototype.loadObject = function(object, from, requestAmount) {
        console.log("APS.loadObject:");
        if (typeof from === "undefined") from = this.planet;
        //let c = autopilot.getColony(from.id, true);
        let c = autopilot.getColony(from.id);
        c.updateBalance(false);
        if (c.isOwnPlanet) {
            let curCapacity = this.getCurCapacity(object);
            if (curCapacity <= 0) return 0;
            let excess = 0;
            if (typeof this.functionModule.getExcess === "function") {
                excess = this.functionModule.getExcess(this, object);
            } else {
                // FUEL BALANCE EXCEPTIONS
                if (object === "fuel") {
                    excess = from.neutronium;
                    object = "neutronium";
                } else {
                    excess = c.balance[object];
                    // ALCHEMY BALANCE EXCEPTION
                    //if (object === "supplies" && this.primaryFunction === "alc") excess = from.supplies; // overwrite balance
                    // EXPANDER & BUILDER BALANCE EXCEPTIONS
                    if (object === "supplies" && (this.primaryFunction === "exp" || (this.primaryFunction === "bld" && this.objectOfInterest === "stb")) && c.hasStarbase) excess = from.supplies - parseInt(autopilot.settings.defSupRetention); // overwrite balance
                    if (object === "megacredits" && (this.primaryFunction === "exp" || (this.primaryFunction === "bld" && (this.objectOfInterest === "stb" || this.objectOfInterest === "bab"))) && c.hasStarbase) excess = from.megacredits - parseInt(autopilot.settings.defMcsRetention); // overwrite balance
                    //if (object === "megacredits" && this.primaryFunction === "col") excess = from.megacredits - parseInt(autopilot.settings.defMcsRetention); // overwrite balance
                    // colonist balance correction
                    if (object === "clans" && excess < 0) {
                        let minColPop = [c.minColPop, c.optNatTaxClans, c.optBovSupClans, c.optLabor];
                        minColPop.sort(function(a, b) { return b - a });
                        if (from.clans > minColPop[0]) excess = from.clans - minColPop[0];
                    }
                    //
                }
            }
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
                c.updateBalance();
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
                c.updateBalance();
            }
            console.log("...loaded " + actAmount + " " + object + " from planet " + from.id);
            return actAmount;
        }
        return false;
    };
    // local storage
    APS.prototype.updateStoredData = function() {
        console.log("APS.updateStoredData:");
        let destination = false;
        if (this.destination) destination = this.destination.id;
        let sDestination = false;
        if (this.secondaryDestination) sDestination = this.secondaryDestination.id;
        let lDestination = false;
        if (this.lastDestination) lDestination = this.lastDestination.id;
        let storedData = {
            sid: this.ship.id,
            base: this.base.id,
            destination: destination,
            secondaryDestination: sDestination,
            lastDestination: lDestination,
            shipFunction: this.primaryFunction,
            newFunction: this.newFunction,
            oShipMission: this.oShipMission,
            ooiPriority: this.objectOfInterest,
            newOoiPriority: this.newOoiPriority,
            idle: this.isIdle,
            idleReason: this.idleReason,
            idleTurns: this.idleTurns
        };
        if (!storedData.destination && !storedData.idle) {
            console.error("...APS without destination and idle = false!");
        } else {
            console.log("...data:", storedData);
            autopilot.apsShips.update(this.ship.id, storedData);
            autopilot.apsShips.save();
        }
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
AlchemyAPS.prototype.handleCargo = function (aps) {
    if (aps.planet) {
        aps.unloadAll();
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

    if (aps.potDest.length === 0) {
        console.log("...no destinations available!");
        aps.isIdle = true;
        if (aps.idleReason.indexOf("Dest") === -1) aps.idleReason.push("Dest");
    } else {
        aps.isIdle = false;
        console.log(aps.potDest);
    }
};
AlchemyAPS.prototype.validateMissionDestinations = function(aps)
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
AlchemyAPS.prototype.loadCargo = function(aps) {
    let loaded = 0;
    if (aps.objectOfInterest === "neu") {
        let c = autopilot.getColony(aps.planet.id, true);
        if (c.planet.supplies <= parseInt(autopilot.settings.defSupRetention)) return loaded; // make sure at least 1 supply is available...
        let bc = [
            {
                mineral: "tritanium",
                value: c.planet.tritanium
            },
            {
                mineral: "duranium",
                value: c.planet.duranium
            },
            {
                mineral: "molybdenum",
                value: c.planet.molybdenum
            }
        ];
        bc = autopilot.sortCollection(bc, "value", "desc");
        let toTransform = Math.floor(aps.hull.cargo * 0.5); // max possible
        if (toTransform > c.planet.supplies - parseInt(autopilot.settings.defSupRetention)) toTransform = c.planet.supplies - parseInt(autopilot.settings.defSupRetention); // limited by supplies ?
        if (toTransform > bc[0].value) toTransform = bc[0].value; // limited by minerals?
        if (toTransform > 0) {
            loaded += aps.loadObject(bc[0].mineral, aps.planet, toTransform);
            loaded += aps.loadObject("supplies", aps.planet, toTransform);
        }
    } else
    {
        loaded += aps.loadObject("supplies");
    }
    return loaded;
};
/*
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
BuilderAPS.prototype.initialLoading = function(aps) {
    if (aps.colony.isAPSSource(aps)) { // is there something available we need?
        aps.unload();
        if (aps.demand.getApsDemand(aps).length > 0) {
            this.loadCargo(aps); // load cargo
        } else {
            console.error("No demand at destination!");
            return -1;
        }
    }
    return aps.demand.getApsDemand(aps);
};
BuilderAPS.prototype.handleCargo = function (aps) { // called once on initialization and a second time with aps.confirmMission
    console.log("BuilderAPS.handleCargo:");
    if (aps.planet && aps.isOwnPlanet) {
        if (aps.destination.id === aps.planet.id) { // unload cargo when at destination
            aps.unloadAll();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id) { // load cargo if we are at secondary destination
            aps.colony.updateBalance();
            if (this.initialLoading(aps) === -1) {
                console.warn("...at secondary destination, with no demand left!");
                aps.lastDestination = aps.secondaryDestination;
                aps.secondaryDestination = false;
                aps.destination = false;
                aps.setShipIdleStatus({ isIdle: true });
            }
        } else { // transit planet or former destination (primary or secondary)
            aps.colony.updateBalance();
            if (!aps.secondaryDestination) { // we are on our way to the destination
                let remainingDemandItems = this.initialLoading(aps);
                if (remainingDemandItems === -1) {
                    aps.lastDestination = aps.destination;
                    aps.destination = false;
                    aps.setShipIdleStatus({ isIdle: true });
                } else if (remainingDemandItems.length > 0) { // if we still have capacity left and not all demand is satisfied, we need a secondary destination
                    if ((remainingDemandItems.containMoney() && aps.ship.megacredits < 10000) ||
                        (remainingDemandItems.containFuel() && aps.hull.neutronium < aps.hull.fueltank) ||
                        (remainingDemandItems.containCargo() && aps.getCurCapacity() > 0)) {
                        this.setSecondaryDestination(aps, false);
                        if (aps.secondaryDestination && (aps.ship.targetx !== aps.secondaryDestination.x || aps.ship.targety !== aps.secondaryDestination.y)) aps.setShipTarget(); // re-set target if necessary
                    }
                }
            }
        }
    }
}; // called by APS
BuilderAPS.prototype.loadCargo = function(aps) {
    let loaded = 0;
    if (aps.planet && aps.planet.id !== aps.destination.id) { // toDo: no loading if at destination planet since ship builders demand is not yet integrated into colony balance!!!
        console.log("BuilderAPS.loadCargo:");
        console.log("...current demands:", aps.demand);
        let capacityDemand = aps.demand.getApsDemand(aps);
        if (capacityDemand.length > 0) {
            // check if megecredits are demanded
            console.log("...capacity demand:", capacityDemand);
            aps.colony.updateBalance();
            if (aps.demand.findByResourceName("megacredits") > 0) aps.colony.sellSupplies4APS(aps);
            capacityDemand.forEach(
                function (demand, index) {
                    loaded += aps.loadObject(demand.item, aps.planet, demand.value);
                }
            );
            console.log("APS %s with minCapacity of %s has current capacity %s", aps.ship.id, aps.minCapacity, aps.getCurCapacity());
            //
            if (aps.objectOfInterest === "stb" && aps.getCurCapacity() > aps.minCapacity && (aps.demand.findByResourceName("supplies") > 0 || aps.demand.findByResourceName("clans") > 0)) { // try to load to minCapacity
                let furtherLoad = true;
                while (aps.getCurCapacity() >= aps.minCapacity && furtherLoad) {
                    let seqLoad = false;
                    this.priorities.stb.forEach(
                        function (item, index) {
                            let obj = aps.moveablesMap[item];
                            if (obj === "megacredits") return;
                            let value = aps.demand.findByResourceName(obj);
                            let curLoad = aps.loadObject(obj, aps.planet, value);
                            if (value > 0 && curLoad) {
                                seqLoad = true;
                                loaded += curLoad;
                            }
                        }
                    );
                    if (!seqLoad) furtherLoad = false;
                }
            }
        }
    }
    return loaded;
};

BuilderAPS.prototype.setPotentialDestinations = function(aps) {
    if (aps.potDest.length === 0) {
        aps.potDest = this.getConstructionSites(aps);
        if (aps.potDest < 1) {
            console.warn("No construction sites available!");
            aps.setShipIdleStatus( { isIdle: true, idleReason: "Dest", idleTurns: 0 } );
        } else {
            aps.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
        }
    }
}; // called by APS
BuilderAPS.prototype.validateMissionDestinations = function(aps) {
    // no module specific filtering
}; // called by APS
BuilderAPS.prototype.getNextPrimaryDestination = function(aps, ctP) {
    let cSites = this.getConstructionSites(aps, ctP);
    if (cSites.length > 0) {
        console.log("...next target is new destination", cSites[0].planet);
        return cSites[0].planet;
    } else {
        console.log("...next target is BASE", aps.base);
        return aps.base;
    }
}; // called by APS
BuilderAPS.prototype.hasMissionConflict = function(aps, potPlanet, secondary) {
    // Deactivated since demand and deliveries of all APS are considered during destination determination!
    return false;
}; // called by APS
BuilderAPS.prototype.confirmMission = function (aps) {
    if (aps.planet && aps.destination.id === aps.planet.id && !aps.secondaryDestination) {
        if (aps.objectOfInterest !== "fib") {
            console.warn("BuilderAPS.confirmMission: WE ARE AT DESTINATION PLANET WITHOUT SECONDARY DESTINATION SET...!");
            // it appears that the destination has no demand left... search for another destination...
        }
    }
    if (!aps.targetIsSet() && aps.planet && aps.planet.id !== aps.destination.id) {
        aps.setMissionDestination();
    }
}; // called by APS
BuilderAPS.prototype.missionCompleted = function(aps) {
    if (aps.objectOfInterest === "fib") return false;
    let cC = autopilot.getColony(aps.destination.id, true);
    let demand = cC.getAPSDemand(aps);
    if (demand.length === 0) return true;
    let demandCargo = demand.reduce(function (total, d) {
        if (d.item === "megacredits") return total;
        return total + d.value;
    });
    return (demandCargo < aps.minCapacity);
}; // called by APS
BuilderAPS.prototype.getConstructionSites = function(aps, exclude) {
    console.log("BuilderAPS.getConstructionSites:");
    if (typeof exclude === "undefined") exclude = false;
    this.setScopeRange(aps);
    let sites = [];
    if (aps.objectOfInterest === "bab") {
        sites = this.pickBase(this.classifyBases(this.getBasesToDevelop(aps, exclude), aps), aps);
        console.log("...pickedBase:", sites);
    } else if (aps.objectOfInterest === "stb") {
        sites = this.classifyDevelopmentSites(this.getPlanetsToDevelop(aps, exclude), aps);
    } else if (aps.objectOfInterest === "fib") {
        sites = this.classifyProductionSites(this.getProductionSites(aps, exclude), aps);
    } else if (aps.objectOfInterest === "shb") {
        if (aps.planet) {
            if ((aps.colony.isBuildingBase || aps.colony.hasStarbase) && !aps.colony.isFort && aps.colony.getAPSDemand(aps).length > 0) { // if APS is at a starbase that has demand, bind APS to it
                sites = [aps.colony];
            }
        }
        if (sites.length === 0) {
            sites = this.classifyBases(this.getPlanetsWithStarbase(aps, exclude), aps);
        }
    }
    console.log("...construction sites:", sites);
    return sites;
};
BuilderAPS.prototype.setScopeRange = function(aps) {
    aps.scopeRange = aps.simpleRange * 2;
    if (this.scopeRange === "auto") {
        if (aps.objectOfInterest === "bab" || aps.objectOfInterest === "shb") {
            aps.scopeRange = aps.simpleRange * 3; // toDo: changed 20.01.2019 (4->3)
        }
    } else {
        aps.scopeRange = parseInt(this.scopeRange);
    }
};
// BASE BUILDER
BuilderAPS.prototype.getBasesToDevelop = function(aps, exclude) {
    console.log("BuilderAPS.getBasesToDevelop:");
    if (typeof exclude === "undefined") exclude = false;
    let sbDevColonies = autopilot.getStarbaseDevelopingColonies();
    console.log("...sbDevColonies:", sbDevColonies);
    let potSites = sbDevColonies.filter(function (c) {
        if (exclude && exclude.id === c.planet.id) return false;
        //let demand = c.getAPSDemand(aps);
        c.distance2APS = aps.getDistance(c.planet);
        return true;
        //return demand.length > 0; // toDo: changed 20.01.19, demand is validated in pickBase
    });
    console.log("...potential starbase development sites:", potSites);
    return potSites;
};
BuilderAPS.prototype.pickBase = function(classifiedSites, aps) {
    /*classifiedSites.sort(function(a, b){
        return a.distance2APS - b.distance2APS;
    });*/
    let closeBuildingSites = classifiedSites.filter(function (c) {
        return c.isBuildingBase && c.distance2APS <= aps.simpleRange * 2;
    });
    let closeToFortifySites = classifiedSites.filter(function (c) {
        return !c.isFortified && c.distance2APS <= aps.simpleRange * 2;
    });
    if (closeBuildingSites.length > 0 && closeToFortifySites.length > 0) {
        classifiedSites = [].concat(closeBuildingSites, closeToFortifySites, classifiedSites);
    } else if (closeBuildingSites.length > 0) {
        classifiedSites = [].concat(closeBuildingSites, classifiedSites);
    } else if (closeToFortifySites.length > 0) {
        classifiedSites = [].concat(closeToFortifySites, classifiedSites);
    } else {
        let sbBuildingSites = classifiedSites.filter(function (c) {
            return c.isBuildingBase;
        });
        if (sbBuildingSites.length > 0) {
            classifiedSites = [].concat(sbBuildingSites, classifiedSites);
        } // prioritize planets that are marked to build a starbase
    }
    let pickedBase = [];
    while (pickedBase.length === 0 && classifiedSites.length > 0) {
        let baseToValidate = classifiedSites.shift();
        baseToValidate.updateBalance();
        let demand = baseToValidate.getAPSDemand(aps);
        if (demand.filter(function (d) {
            return d.item !== "megacredits"; // toDo: should an APS transport only megacredits? fuel consumption?
        }).length > 0 && baseToValidate.determineSafety()) pickedBase.push(baseToValidate);
    }
    return pickedBase;
};
// BASE SHIP-BUILDER
BuilderAPS.prototype.getPlanetsWithStarbase = function(aps, exclude) {
    console.log("BuilderAPS.getPlanetsWithStarbase:");
    if (typeof exclude === "undefined") exclude = false;
    let sbColonies = autopilot.getStarbaseColonies();
    let potSites = sbColonies.filter(function (c) {
        if (exclude && exclude.id === c.planet.id) return false;
        let demand = c.getAPSDemand(aps);
        c.distance2APS = aps.getDistance(c.planet);
        return demand.length > 0;
    });
    console.log("...potential starbases:", potSites);
    return potSites;
};
BuilderAPS.prototype.classifyBases = function(sites, aps) {
    console.log("BuilderAPS.classifyBases:");
    let priorizedSites = [];
    if (sites.length > 0) {
        let inScope = sites.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        let outScope = sites.filter(function (c) {
            return c.distance2APS > aps.scopeRange;
        });
        if (inScope.length === 0 && outScope.length > 0) {
            sites = outScope;
            sites.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
        } else if (inScope.length > 0) {
            inScope.sort(function (a, b) {
                    return a.distance2APS - b.distance2APS;
                });
            if (outScope.length > 0) {
                outScope.sort(function (a, b) {
                    return a.distance2APS - b.distance2APS;
                });
                // add construction site outside the scope range to the end
                inScope.push(outScope.shift());
                while (inScope.length < 5 && outScope.length > 0) {
                    inScope.push(outScope.shift()); // add other construction site outside the scope range if inScope contains less than 5 targets
                }
            }
            sites = inScope;
        }
        console.log("...potential starbase planets", sites);
        // classify according to resources within range
        let richSites = sites.filter(function (c) {
            let durRatio = c.mineralsInRange.duranium / autopilot.globalMinerals.duranium;
            let triRatio = c.mineralsInRange.tritanium / autopilot.globalMinerals.tritanium;
            let molRatio = c.mineralsInRange.molybdenum / autopilot.globalMinerals.molybdenum;
            return (durRatio >= 0.25 && triRatio >= 0.25 && molRatio >= 0.25);
        });
        //console.log("richSites", richSites);
        let moderateSites = sites.filter(function (c) {
            let durRatio = c.mineralsInRange.duranium / autopilot.globalMinerals.duranium;
            let triRatio = c.mineralsInRange.tritanium / autopilot.globalMinerals.tritanium;
            let molRatio = c.mineralsInRange.molybdenum / autopilot.globalMinerals.molybdenum;
            return ((durRatio >= 0.1 && durRatio < 0.25) && (triRatio >= 0.1 && triRatio < 0.25) && (molRatio >= 0.1 && molRatio < 0.25));
        });
        //console.log("moderateSites", moderateSites);
        let richAndModerateIds = [].concat(richSites.map(function (c) {
            return c.planet.id;
        }),moderateSites.map(function (c) {
            return c.planet.id;
        }));
        let poorSites = sites.filter(function (c) {
            return richAndModerateIds.indexOf(c.planet.id) === -1;
        });
        //console.log("poorSites", poorSites);
        priorizedSites = [].concat(richSites, moderateSites, poorSites);
    }
    console.warn("...prioritized starbase planets", priorizedSites);
    return priorizedSites;
};
// STRUCTURE BUILDER
BuilderAPS.prototype.getPlanetsToDevelop = function(aps, exclude) {
    console.log("BuilderAPS.getPlanetsToDevelop:");
    if (typeof exclude === "undefined") exclude = false;
    this.setScopeRange(aps);
    let sbColonies = autopilot.getStructureBuildingColonies();
    let potSites = sbColonies.filter(function (c) {
        if (exclude && exclude.id === c.planet.id) return false;
        let demand = c.getAPSDemand(aps);
        console.log("...colony builder demand:", c.id, demand);
        c.distance2APS = aps.getDistance(c.planet);
        return demand.length > 0 && c.distance2APS <= aps.scopeRange;
    });
    console.log("...potential construction sites:", potSites);
    return potSites;
};
BuilderAPS.prototype.classifyDevelopmentSites = function(potSites, aps) {
    console.log("BuilderAPS.classifyDevelopmentSites:");
    if (potSites.length > 1) {
        let inScope = potSites.filter(function (c) {
            return c.distance2APS <= aps.scopeRange;
        });
        let outScope = potSites.filter(function (c) {
            return c.distance2APS > aps.scopeRange;
        });
        if (inScope.length === 0 && outScope.length > 0) {
            potSites = outScope;
            potSites.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
        } else if (inScope.length > 0) {
            inScope.sort(function (a, b) {
                return a.distance2APS - b.distance2APS;
            });
            if (outScope.length > 0) {
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
    // classify according to resources
    let resRichSites = potSites.filter(function (c) {
        return c.k75Minerals.length > 0;
    });
    let resModerateSites = potSites.filter(function (c) {
        return c.k50Minerals.length > 0;
    });
    let resLessSites = potSites.filter(function (c) {
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
// FIGHTER BUILDER
BuilderAPS.prototype.getProductionSites = function(aps, exclude) {
    console.log("BuilderAPS.getProductionSites:");
    if (typeof exclude === "undefined") exclude = false;
    let potSites = [];
    let resources = ["tritanium", "molybdenum", "supplies"];
    let oneTurnProductionCosts = this.getFillWithFighterCosts(aps, aps.getCurCapacity(), 0, 1);
    for (let i = 0; i < vgap.myplanets.length; i++) {
        let p = vgap.myplanets[i];
        if (exclude && exclude.id === p.id) continue;
        let ready4production = true;
        resources.forEach(function (r) {
            if (p[r] < oneTurnProductionCosts[r]) ready4production = false;
        });
        if (ready4production)
        {
            let c = autopilot.getColony(vgap.myplanets[i].id);
            c.distance2APS = aps.getDistance(c.planet);
            potSites.push(c);
        }
    }
    console.log("...potential production sites:", potSites);
    return potSites;
};
BuilderAPS.prototype.getFillWithFighterCosts = function(aps, capacity, pThresh, turns) {
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
BuilderAPS.prototype.classifyProductionSites = function(sites, aps) {
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

BuilderAPS.prototype.confirmSecondaryDestination = function(aps, potSecDest) {
    if (aps.planet && aps.planet.id === aps.destination.id) return true;
    if (potSecDest.distance2APS > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity() <= aps.minCapacity) {
        console.warn("...we are closer to destination and have minCapacity on board, proceed to destination!");
    } else if (potSecDest.distance2Site > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity(aps.objectOfInterest) <= aps.minCapacity) {
        console.warn("...the source is further away than current position and we have minCapacity on board, proceed to destination!");
    }  else {
        return true;
    }
    return false;
};
BuilderAPS.prototype.setSecondaryDestination = function(aps, load) {
    console.info("BuilderAPS.setSecondaryDestination:");
    if (typeof load === "undefined") load = true;
    if (aps.planet && load) this.initialLoading(aps);
    if (aps.getCargoCapacity() === 0) return; // console.log("...full capacity reached! Proceed to destination!");
    if (!load || aps.demand.getApsDemand(aps).length > 0) {
        console.log("...current status of demand:", aps.demand.getApsDemand(aps));
        let potSource = this.pickSource(aps);
        if (potSource && this.confirmSecondaryDestination(aps, potSource)) {
            aps.secondaryDestination = potSource.planet;
            console.log("...secondary destination set.", aps.secondaryDestination);
        } else if (!potSource) { // no secondary destination (sufficient source) found
            if (aps.getCurCapacity() === aps.maxCapacity && aps.getCurCapacity("megacredits") === 10000) {
                console.warn("...couldn't find an adequate secondary destination, APS idle!");
                aps.setShipIdleStatus( { isIdle: true, idleReason: "Source N/A", idleTurns: 0 } );
            } else {
                console.info("...couldn't find an adequate secondary destination, delivering cargo to destination!");
            }
        }
    }
}; // called by APS
BuilderAPS.prototype.getNextSecondaryDestination = function(aps, ctP) {
    let ctC = autopilot.getColony(ctP.id, true);
    let nextDemands = ctC.getNextAPSDemand(aps, aps.demand);
    if (nextDemands.length === 0) {
        return false;
    } else {
        let source = this.pickSource(aps, ctP, nextDemands);
        if (source) {
            console.log("...next secondary destination:", source.planet.id);
            return source.planet;
        } else {
            // return base planet if no secondary destination could be found
            console.log("...next secondary destination: base => ", aps.base.id);
            return aps.base;
        }
    }
}; // called by APS
BuilderAPS.prototype.getSources = function(aps) {
    console.log("BuilderAPS.getSources:");
    let potColonies = [];
    let targetsInRange = vgap.myplanets; // default: all my planets are targets
    let here2siteTurnDist = Math.ceil(aps.getDistance(aps.destinationColony.planet, false) / aps.simpleRange);
    this.setScopeRange(aps);
    if (aps.destinationColony.isFortified) aps.scopeRange = 81;
    let scopeTurnDist = Math.ceil(aps.scopeRange / aps.simpleRange);
    // APS is currently at site or within the scopeRange of site (or site is fortified)
    if (aps.planet && aps.planet.id === aps.destinationColony.planet.id || here2siteTurnDist <= scopeTurnDist || aps.destinationColony.isFortified) {
        targetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange); // targets within scope range
    }
    targetsInRange = targetsInRange.filter(function (t) {
        if (aps.planet) return t.id !== aps.destinationColony.planet.id && t.id !== aps.planet.id;
        return t.id !== aps.destinationColony.planet.id;
    }); // remove current and destination planet
    console.log("...found %s potential sources within %s lys.", targetsInRange.length, aps.scopeRange, targetsInRange);

    if (targetsInRange.length > 0) {
        let self = this;
        targetsInRange.forEach(
            function (t, index) {
                let curC = autopilot.getColony(t.id, true);
                curC.distance2APS = aps.getDistance(t);
                curC.distance2Site = autopilot.getDistance(curC.planet, aps.destinationColony.planet);
                curC.turns2Site = Math.ceil(autopilot.getDistance(curC.planet, aps.destinationColony.planet) / aps.simpleRange);
                if (here2siteTurnDist > scopeTurnDist) {
                    if (curC.turns2Site <= here2siteTurnDist + 1 && self.colonyIsSource(aps, curC) && curC.determineSafety()) potColonies.push( curC );
                } else {
                    if (self.colonyIsSource(aps, curC) && curC.determineSafety()) potColonies.push( curC );
                }
            }
        );
    }
    console.log("...potColonies:", potColonies);
    return potColonies;
};
BuilderAPS.prototype.pickSource = function(aps, excludePlanet, demands) {
    console.log("BuilderAPS.pickSource:");
    if (typeof excludePlanet === "undefined") excludePlanet = false;
    if (typeof demands === "undefined") demands = aps.demand.getApsDemand(aps);
    let source = false;
    let potColonies = this.getSources(aps);
    if (potColonies.length > 0) {
        if (potColonies.length > 1) {
            let finalSourceCollection = this.getClassifiedSources(aps, potColonies, demands);
            console.log("...finalSourceCollection:", finalSourceCollection);
            for (let i = 0; i < finalSourceCollection.length; i++) {
                if (excludePlanet && excludePlanet.id === finalSourceCollection[i].planet.id) continue;
                return finalSourceCollection[i];
            }
        } else {
            if (excludePlanet && excludePlanet.id === potColonies[0].planet.id) return false;
            return potColonies[0];
        }
    }
    return source;
};
BuilderAPS.prototype.getClassifiedSources = function(aps, sources, demands) {
    console.log("BuilderAPS.getClassifiedSources:", aps.destinationColony);
    console.log("...builderDemands:", demands);
    demands.sort(function(a, b) {
        if (a.item === "megacredits") return -1;
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
    let concatCollections = [].concat(satisfyingMostLacking, satisfyingAll, offeringMinCapacity, satisfyingSome);
    if (concatCollections.length === 0) {
        sources.sort(function (a, b) {
            return b.balance[demands[0].item] - a.balance[demands[0].item];
        });
        console.log("...sortedSources (fallBack):", sources);
        return sources;
    } else {
        return concatCollections;
    }
};
BuilderAPS.prototype.colonyIsSource = function(aps, colony) {
    let isSource = false;
    if (aps.objectOfInterest === "shb" && ((colony.hasStarbase || colony.isBuildingBase) && !colony.isFort)) return false; // ship builders don't use other ship building starbases as source
    aps.demand.getApsDemand(aps).forEach(
        function (demand, index) {
            if (colony.balance[demand.item] > 0) isSource = true;
        }
    );
    return isSource;
};

BuilderAPS.prototype.setPotentialWaypoints = function(aps) {
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
}; // called by APS
BuilderAPS.prototype.postActivationHook = function (aps) {
    if (aps.objectOfInterest === "fib") aps.ship.friendlycode = "lfm";
}; // called by APS
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
CollectorAPS.prototype.initialLoading = function(aps) {
    console.log(aps.demand);
    if (aps.colony.isCollectorSource(aps)) { // is there something available we need?
        if (aps.getCurCapacity() < aps.maxCapacity) aps.unload();
        if (aps.demand.getApsDemand(aps).length > 0) {
            this.loadCargo(aps); // load cargo
        } else {
            console.error("No demand at destination!");
            return -1;
        }
    }
    return aps.demand.getApsDemand(aps).length;
};
CollectorAPS.prototype.handleCargo = function(aps) { // called once on initialization and a second time with aps.confirmMission
    console.log("DistributorAPS.handleCargo:");
    if (aps.planet && aps.isOwnPlanet) {
        if (aps.destination.id === aps.planet.id) { // we are at base (sink)
            aps.unloadAll();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id) { // load cargo if we are at secondary destination
            aps.colony.updateBalance();
            if (this.initialLoading(aps) === -1) {
                console.warn("...at secondary destination, with no demand left!");
                aps.lastDestination = aps.secondaryDestination;
                aps.secondaryDestination = false;
                aps.destination = false;
                aps.setShipIdleStatus({ isIdle: true });
            }
        } else { // transit planet or former destination (primary or secondary)
            aps.colony.updateBalance();
            if (!aps.secondaryDestination) { // we are on our way to the destination
                let remainingDemandItems = this.initialLoading(aps);
                if (remainingDemandItems > 0 && aps.getCargoCapacity() > 0) { // if we still have capacity left and not all demand is satisfied, we need a secondary destination
                    this.setSecondaryDestination(aps, false);
                    if (aps.secondaryDestination && (aps.ship.targetx !== aps.secondaryDestination.x || aps.ship.targety !== aps.secondaryDestination.y)) aps.setShipTarget(); // re-set target if necessary
                } else if (remainingDemandItems === 0) {
                    aps.lastDestination = aps.destination;
                    aps.destination = false;
                    aps.setShipIdleStatus({ isIdle: true });
                }
            }
        }
    }
};
CollectorAPS.prototype.setPotentialDestinations = function(aps) {
    console.log("CollectorAPS.setPotentialDestinations:");
    aps.potDest = [ autopilot.getColony(aps.base.id) ];
};
CollectorAPS.prototype.confirmSecondaryDestination = function(aps, potSecDest) {
    if (aps.planet && aps.planet.id === aps.destination.id) return true;
    if (potSecDest.distance2APS > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity() <= aps.minCapacity) {
        console.warn("...we are closer to destination and have minCapacity on board, proceed to destination!");
    } else if (potSecDest.distance2Site > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity(aps.objectOfInterest) <= aps.minCapacity) {
        console.warn("...the source is further away than current position and we have minCapacity on board, proceed to destination!");
    }  else {
        return true;
    }
    return false;
};
CollectorAPS.prototype.setSecondaryDestination = function(aps, load) {
    console.info("CollectorAPS.setSecondaryDestination:");
    if (typeof load === "undefined") load = true;
    if (aps.planet && aps.planet.id !== aps.base.id && load) this.initialLoading(aps);
    if (aps.getCargoCapacity() === 0) return; // console.log("...full capacity reached! Proceed to destination!");
    if (!load || aps.demand.getApsDemand(aps).length > 0) {
        console.log("...current status of demand:", aps.demand.getApsDemand(aps));
        let potSource = this.pickSource(aps);
        if (potSource && this.confirmSecondaryDestination(aps, potSource)) {
            aps.secondaryDestination = potSource.planet;
            console.log("...secondary destination set.", aps.secondaryDestination);
        }  else if (!potSource) { // no secondary destination (sufficient source) found
            if (aps.getCurCapacity() === aps.maxCapacity && aps.getCurCapacity("megacredits") === 10000) {
                console.warn("...couldn't find an adequate secondary destination, APS idle!");
                aps.setShipIdleStatus( { isIdle: true, idleReason: "Source N/A", idleTurns: 0 } );
            } else {
                console.info("...couldn't find an adequate secondary destination, delivering cargo to destination!");
            }
        }
    }
};
CollectorAPS.prototype.setPotentialWaypoints = function(aps) {
    let pwps = autopilot.frnnOwnPlanets; // necessary to prevent frnnOwnPlanets from being modified by modification of aps.potentialWaypoints // toDo: ???
    aps.potentialWaypoints = pwps;
};
CollectorAPS.prototype.validateMissionDestinations = function(aps)
{
    let filteredDest = [];
    console.log("...filtering collector destinations: " + aps.potDest.length);
    for (let i = 0; i < aps.potDest.length; i++)
    {
        if (aps.potDest[i].pid !== aps.base.id)
        {
            let c = autopilot.getColony(aps.potDest[i].pid);
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
    console.log("CollectorAPS.confirmMission:");
    if (aps.getCurCapacity(aps.objectOfInterest) === 0)
    {
        console.log("...current capacity %s / %s", aps.getCurCapacity(aps.objectOfInterest), aps.maxCapacity);
        aps.potDest = [ autopilot.getColony(aps.base.id) ];
        aps.setMissionDestination();
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
    //return aps.getCurCapacity(aps.objectOfInterest) <= aps.minCapacity;
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
        if (this.isMineralCollector(aps) || aps.objectOfInterest === "mcs" || aps.objectOfInterest === "sup") {
            aps.scopeRange = aps.simpleRange * 2;
        } else {
            let inRange = aps.getAPSinRange(aps.simpleRange); // uses default: simpleRange
            if (inRange && inRange.length > 4 || aps.objectOfInterest === "cla") {
                aps.scopeRange = aps.simpleRange * 3;
            } else {
                aps.scopeRange = aps.simpleRange * 2;
            }
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
    let obj = aps.moveablesMap[aps.objectOfInterest];
    let maxSources = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        if (oiBalance >= aps.maxCapacity) c.sourceType.push("max");
        return (oiBalance >= aps.maxCapacity);
    });
    let minSources = colonies.filter(function (c) {
        let oiBalance = c.balance[obj];
        if (oiBalance >= aps.minCapacity && oiBalance < aps.maxCapacity) c.sourceType.push("min");
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
CollectorAPS.prototype.setSources = function(aps) {
    console.log("CollectorAPS.setSources:");
    this.setScopeRange(aps);
    let obj = aps.moveablesMap[aps.objectOfInterest];
    let potColonies = [];
    let scope = aps.scopeRange;
    // check if there is max capacity of resource available within scope range
    let availableOOI = autopilot.getSumOfObjectInRange(aps.base, aps.scopeRange, obj);
    if (availableOOI < aps.minCapacity && obj !== "megacredits") {
        // if not increase scope range? by 50 %?
        scope = Math.floor(scope * 1.5);
    }
    // get sources within scope range
    let scopeSources = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, scope);
    scopeSources.forEach(function (p) {
        let curC = autopilot.getColony(p.id, true);
        curC.distance2APS = aps.getDistance(p);
        curC.eta2Source = Math.ceil(aps.getDistance(p) / aps.simpleRange);
        if (curC.planet.id !== aps.base.id && curC.isCollectorSource(aps)) potColonies.push(curC);
    });
    console.log("... sources within scope:", potColonies);
    this.sources = this.classifySources(potColonies, aps);
};
CollectorAPS.prototype.classifySources = function(pSources, aps) {
    let sourceCollection = [];
    let obj = aps.moveablesMap[aps.objectOfInterest];
    if (pSources.length > 0) {
        // add to collection:
        // planets providing curCapacity within scope sorted by eta distance
        let curCapacitySources = pSources.filter(function (c) {
            if (obj === "megacredits") return (c.balance[obj] + c.balance.supplies >= aps.getCurCapacity(obj));
            return (c.balance[obj] >= aps.getCurCapacity(obj));
        })
        sourceCollection = sourceCollection.concat(curCapacitySources);
        sourceCollection.sort(function (a, b) {
            return a.distance2APS - b.distance2APS;
        });
        console.log("...planets providing curCapacity:", sourceCollection);
        if (sourceCollection.length === 0) {
            // planets providing less than curCapacity within scope sorted by eta distance
            let lessCapacitySources = pSources.filter(function (c) {
                if (obj === "megacredits") return (c.balance[obj] + c.balance.supplies < aps.getCurCapacity(obj));
                return (c.balance[obj] < aps.getCurCapacity(obj));
            });
            sourceCollection = sourceCollection.concat(lessCapacitySources);
            // if at base, fly to most distant source in order to pick up more from other lessCapacity sources on the way back
            if (aps.planet && aps.planet.id === aps.base.id) {
                sourceCollection.sort(function (a, b) {
                    return b.distance2APS - a.distance2APS;
                });
            } else {
                sourceCollection.sort(function (a, b) {
                    return b.balance[obj] - a.balance[obj];
                });
            } // else, fly to closest source
            console.log("...planets providing less than curCapacity:", sourceCollection);
        }
    }
    return sourceCollection;
};
CollectorAPS.prototype.pickSource = function(aps) {
    this.setSources(aps);
    let sourceCollection = this.classifySources(this.sources, aps);
    if (sourceCollection.length > 0) {
        return sourceCollection.shift();
    } else {
        return false;
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
            sum -= vgap.getShip(cAPS.sid)[aps.moveablesMap[cAPS.ooiPriority]];
        } else
        {
            sum += aps.maxCapacity;
        }
    }
    return sum;
};
CollectorAPS.prototype.colonyIsSource = function(aps, colony)
{
    let isSource = false;
    this.setDemand(aps);
    aps.demand.forEach(
        function (demand, index) {
            if (colony.balance[demand.item] > 0) isSource = true;
        }
    );
    return isSource;
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
    bSequence.forEach(function(seq){ lSequence.push(aps.moveablesMap[seq.res]); });
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
CollectorAPS.prototype.loadCargo = function(aps) { // not called at BASE
    let loaded = 0;
    // mineral handling
    if (this.isMineralCollector(aps) && aps.getCurCapacity() > 0) {
        console.log("...loading minerals...");
        loaded = this.loadMinerals(aps);
    } else if (aps.getCurCapacity(aps.moveablesMap[aps.objectOfInterest]) > 0) {
        console.log("...loading other stuff...");
        if (aps.objectOfInterest === "mcs") {
            if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid")) { // are we transforming supplies to MCs first?
                aps.colony.sellSupply(true);
            }
        }
        loaded = aps.loadObject(aps.moveablesMap[aps.objectOfInterest], aps.planet);
    }
    if (aps.objectOfInterest !== "megacredits") {
        // we generally collect megacredits if option is active
        if (this.alwaysLoadMC && !aps.colony.hasStarbase || (aps.colony.hasStarbase && aps.colony.isFort)) {
            // are we transforming supplies to MCs first?
            if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid")) {
                aps.colony.sellSupply(true);
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
DistributorAPS.prototype.initialLoading = function(aps) {
    //console.log(aps.demand);
    if (aps.colony.isAPSSource(aps)) { // is there something available we need?
        aps.unload();
        if (aps.demand.getApsDemand(aps).length > 0) {
            this.loadCargo(aps); // load cargo
        } else {
            console.error("No demand at destination!");
            return -1;
        }
    }
    return aps.demand.getApsDemand(aps).length;
};
DistributorAPS.prototype.handleCargo = function (aps) { // called once on initialization and a second time with aps.confirmMission
    console.log("DistributorAPS.handleCargo:");
    if (aps.planet && aps.isOwnPlanet) {
        if (aps.destination.id === aps.planet.id) { // unload cargo when at destination
            aps.unloadAll();
        } else if (aps.secondaryDestination && aps.secondaryDestination.id === aps.planet.id) { // load cargo if we are at secondary destination
            aps.colony.updateBalance();
            if (this.initialLoading(aps) === -1) {
                console.warn("...at secondary destination, with no demand left!");
                aps.lastDestination = aps.secondaryDestination;
                aps.secondaryDestination = false;
                aps.destination = false;
                aps.setShipIdleStatus({ isIdle: true });
            }
        } else { // transit planet or former destination (primary or secondary)
            aps.colony.updateBalance();
            if (!aps.secondaryDestination) { // we are on our way to the destination
                let remainingDemandItems = this.initialLoading(aps);
                if (remainingDemandItems === -1 && aps.destination.id !== aps.base.id) { // no demand left! Ignore if returning to base
                    aps.lastDestination = aps.destination;
                    aps.destination = false;
                    aps.setShipIdleStatus({ isIdle: true });
                } else if (remainingDemandItems.length > 0) { // if we still have capacity left and not all demand is satisfied, we need a secondary destination
                    if ((remainingDemandItems.containMoney() && aps.ship.megacredits < 10000) ||
                        (remainingDemandItems.containFuel() && aps.hull.neutronium < aps.hull.fueltank) ||
                        (remainingDemandItems.containCargo() && aps.getCurCapacity() > 0)) {
                        this.setSecondaryDestination(aps, false);
                        if (aps.secondaryDestination && (aps.ship.targetx !== aps.secondaryDestination.x || aps.ship.targety !== aps.secondaryDestination.y)) aps.setShipTarget(); // re-set target if necessary
                    }
                }
            }
        }
    }
}; // called by APS
DistributorAPS.prototype.loadCargo = function(aps) {
    console.log("DistributorAPS.loadCargo:");
    if (aps.demand.length > 0) {
        let loaded = 0;
        // calculate demand within range, load at least minCapacity
        let loadDemand = aps.minCapacity;
        let demandInRange = 0;
        // get colonies within range
        let scopeCols = autopilot.getTargetsInRange(autopilot.frnnPlanets, aps.destination.x, aps.destination.y, aps.scopeRange);
        scopeCols.forEach(function (t) {
            let p = vgap.planetAt(t.x, t.y);
            let c = autopilot.getColony(p.id, true);
            let demand = c.getAPSDemand(aps);
            console.log("...target Demand:", c.id, c, demand);
            if (demand.length > 0) demandInRange += demand[0].value;
        });
        if (demandInRange > loadDemand) loadDemand = demandInRange;
        if (loadDemand < aps.demand[0].value) loadDemand = aps.demand[0].value;
        loaded += aps.loadObject(aps.demand[0].item, aps.planet, loadDemand);
        return loaded;
    } else {
        return 0;
    }
};

DistributorAPS.prototype.setPotentialDestinations = function(aps) {
    if (this.sinks.length === 0) {
        this.setSinks(aps);
    }
    if (this.sinks.length < 1) {
        console.warn("No sinks available!");
        aps.setShipIdleStatus( { isIdle: true, idleReason: "Dest", idleTurns: 0 } );
    } else {
        aps.potDest = this.sinks;
        aps.setShipIdleStatus( { isIdle: false, idleReason: false, idleTurns: 0 } );
    }
}; // called by APS
DistributorAPS.prototype.setScopeRange = function(aps) {
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
DistributorAPS.prototype.validateMissionDestinations = function(aps) {
    let self = this;
    aps.potDest = aps.potDest.filter(function (c) {
        aps.setDestination(c);
        return self.pickSource(aps, c);
    });
    aps.setDestination(false);
};
DistributorAPS.prototype.hasMissionConflict = function(aps, potPlanet, secondary) {
    if (typeof secondary === "undefined") secondary = false;
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id, "dis", aps.objectOfInterest, secondary);
    if (conflictAPS.length > 0)
    {
        console.log("DistributorAPS.hasMissionConflict:");
        let obj = aps.moveablesMap[aps.objectOfInterest];
        if (!secondary) {
            let pdC = autopilot.getColony(potPlanet.id, true); // potential destination Colony
            let apsCargo = 0;
            conflictAPS.forEach(function (aps) {
                let s = vgap.getShip(aps.sid);
                if (s)
                {
                    if (s[obj] > 0) {
                        apsCargo += s[obj];
                    } else
                    {
                        let hull = vgap.getHull(s.hullid);
                        if (obj === "neutronium") {
                            apsCargo += hull.fueltank;
                        } else {
                            apsCargo += hull.cargo;
                        }
                    }
                }
            });
            console.log("...other APS will deliver %d for balance %d.", apsCargo, pdC.balance[obj]);
            return pdC.balance[obj] + apsCargo >= 0;
        } else {
            let psC = autopilot.getColony(potPlanet.id, true); // potential source Colony
            return psC.balance[obj] < 1; // if the source doesn't offer anything: conflict // toDo: should be redundant since source balance is initialized during source selection
        }
    } else {
        return false;
    }
}; // called by APS
DistributorAPS.prototype.confirmMission = function (aps) {
    console.log("DistributorAPS.confirmMission:");
    if (aps.planet && aps.destination.id === aps.planet.id && !aps.secondaryDestination)
    {
        console.warn("...WE ARE AT DESTINATION PLANET WITHOUT SECONDARY DESTINATION SET...!");
    }
    if (!aps.targetIsSet())
    {
        aps.setMissionDestination();
    }
}; // called by APS
DistributorAPS.prototype.missionCompleted = function(aps) {
    // distributor uses secondary destination.
    // Picking up resources from a source and delivering it to the sink is ONE mission
    // Thus, mission is completed, if current destination does not have demand
    return (aps.demand.length === 0 || aps.demand[0].value < aps.minCapacity);
}; // called by APS
DistributorAPS.prototype.getNextPrimaryDestination = function(aps, ctP) {
    this.setScopeRange(aps);
    let priorityList = this.classifySinks(aps, ctP);
    if (priorityList.length > 0) {
        console.log("...next target is new destination", priorityList[0].planet);
        return priorityList[0].planet;
    } else {
        console.log("...next target is BASE", aps.base);
        return aps.base;
    }
}; // called by APS
DistributorAPS.prototype.setSinks = function(aps) {
    this.setScopeRange(aps);
    this.sinks = this.classifySinks(aps);
    console.log("FINAL SINKS >>", this.sinks);
};
DistributorAPS.prototype.classifySinks = function(aps, exclude) {
    console.log("DistributorAPS.classifySinks:");
    if (typeof exclude === "undefined") exclude = false;
    let classified = [];
    let potSinks = this.getPotentialSinks(aps, exclude); // colonies
    if (potSinks.length > 0) {
        // classify according to resources and natives
        if (aps.objectOfInterest === "cla") {
            let postFeudalNativeSites = potSinks.filter(function (c) {
                return (c.planet.nativegovernment > 5 || (c.planet.nativegovernment > 4 && c.planet.nativeracename === "Avian")) && c.distance2Aps <= aps.scopeRange;
            });
            console.log("...postFeudalNativeSites:", postFeudalNativeSites);
            let filteredIds = postFeudalNativeSites.map(function (c) {
                return c.planet.id;
            });
            let bovinoidNativeSites = potSinks.filter(function (c) {
                return c.planet.nativeracename === "Bovinoid" && c.distance2Aps <= aps.scopeRange;
            });
            console.log("...bovinoidNativeSites:", bovinoidNativeSites);
            filteredIds = filteredIds.concat(bovinoidNativeSites.map(function (c) {
                return c.planet.id;
            }));
            let tecNativeSites = potSinks.filter(function (c) {
                return filteredIds.indexOf(c.planet.id) === -1 && c.hasTecRace && c.distance2Aps <= aps.scopeRange;
            });
            console.log("...tecNativeSites:", tecNativeSites);
            filteredIds = filteredIds.concat(tecNativeSites.map(function (c) {
                return c.planet.id;
            }));
            let otherNativeSites = potSinks.filter(function (c) {
                return filteredIds.indexOf(c.planet.id) === -1 && c.planet.nativegovernment <= 5 && c.distance2Aps <= aps.scopeRange;
            });
            console.log("...otherNativeSites:", otherNativeSites);
            classified = [].concat(postFeudalNativeSites, bovinoidNativeSites, tecNativeSites, otherNativeSites);
        } else if (aps.objectOfInterest === "neu") {
            let withStrandedAPS = potSinks.filter(function (c) {
                return c.withStrandedAPS && c.distance2Aps <= aps.scopeRange;
            });
            withStrandedAPS.sort(function (a, b) {
                return a.balance.neutronium - b.balance.neutronium;
            });
            let normal = potSinks.filter(function (c) {
                return c.distance2Aps <= aps.scopeRange;
            });
            normal.sort(function (a, b) {
                return a.balance.neutronium - b.balance.neutronium;
            });
            classified = classified.concat(withStrandedAPS, normal);
        } else if (aps.objectOfInterest === "mcs") {
            let normal = potSinks.filter(function (c) {
                return c.distance2Aps <= aps.scopeRange;
            });
            classified = classified.concat(normal);
        }
        if (classified.length < 2) {
            let outsideScope = potSinks.filter(function (c) {
                return c.distance2Aps > aps.scopeRange;
            });
            if (outsideScope.length > 0) {
                while (classified.length < 3 && outsideScope.length > 0) {
                    let curC = outsideScope.shift();
                    classified.push( curC );
                }
            } // add two sinks that are outside scope range as backup
        }
    }
    console.log("...classified sinks", classified);
    return classified;
};
DistributorAPS.prototype.getPotentialSinks = function(aps, exclude) {
    console.log("DistributorAPS.getPotentialSinks:");
    if (typeof exclude === "undefined") exclude = false;
    let potSinks = [];
    for (let i = 0; i < vgap.myplanets.length; i++) {
        if (exclude && vgap.myplanets[i].id === exclude.id) continue;
        //let c = autopilot.getColony(vgap.myplanets[i].id, true);
        let c = autopilot.myColonies.findById(vgap.myplanets[i].id);
        c.updateBalance();
        let demand = c.getAPSDemand(aps);
        if (demand.length > 0) {
            // no restrictions on extend of demand, distributors deliver more than demanded!
            c.distance2Aps = c.getDistance(aps.ship);
            c.eta2Aps = Math.ceil(c.getDistance(aps.ship) / aps.simpleRange);
            potSinks.push(c);
        }
    }
    if (potSinks.length > 0) {
        potSinks.sort(function (a, b) {
            return a.distance2Aps - b.distance2Aps;
        });
    }
    console.log("...potential sinks", potSinks);
    return potSinks;
};

DistributorAPS.prototype.confirmSecondaryDestination = function(aps, potSecDest) {
    if (aps.planet && aps.planet.id === aps.destination.id) return true;
    if (potSecDest.distance2APS > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity() <= aps.minCapacity) {
        console.warn("...we are closer to destination and have minCapacity on board, proceed to destination!");
    } else if (potSecDest.distance2Site > aps.destinationColony.getDistance(aps.ship) && aps.getCurCapacity(aps.objectOfInterest) <= aps.minCapacity) {
        console.warn("...the source is further away than current position and we have minCapacity on board, proceed to destination!");
    }  else {
        return true;
    }
    return false;
};
DistributorAPS.prototype.setSecondaryDestination = function(aps, load) {
    console.info("DistributorAPS.setSecondaryDestination:");
    if (typeof load === "undefined") load = true;
    if (aps.planet && load) this.initialLoading(aps);
    if (aps.getCargoCapacity() === 0) return; // console.log("...full capacity reached! Proceed to destination!");
    if (!load || aps.demand.getApsDemand(aps).length > 0) {
        console.log("...current status of demand:", aps.demand.getApsDemand(aps));
        let potSource = this.pickSource(aps);
        if (potSource && this.confirmSecondaryDestination(aps, potSource)) {
            aps.secondaryDestination = potSource.planet;
            aps.secondaryDestination = potSource;
            console.log("...secondary destination set.", aps.secondaryDestination);
        } else if (!potSource) { // no secondary destination (sufficient source) found
            if (aps.getCurCapacity() === aps.maxCapacity && aps.getCurCapacity("megacredits") === 10000) {
                if (this.confirmSecondaryDestination(aps, aps.baseColony)) {
                    aps.secondaryDestination = aps.baseColony.planet;
                    aps.secondaryDestinationColony = aps.baseColony;
                    console.log("...secondary destination set.", aps.secondaryDestination);
                } else {
                    console.warn("...couldn't find an adequate secondary destination, moving to base!");
                    aps.setDestination(aps.baseColony);
                }
            } else {
                console.info("...couldn't find an adequate secondary destination, delivering cargo to destination!");
            }
        }
    }
}; // called by APS
DistributorAPS.prototype.getNextSecondaryDestination = function(aps, ctP) {
    let ctC = autopilot.getColony(ctP.id, true);
    let nextDemands = ctC.getNextAPSDemand(aps, aps.demand);
    if (nextDemands.length === 0) {
        return false;
    } else {
        let source = this.pickSource(aps, aps.destinationColony, ctP, nextDemands);
        if (source) {
            console.log("...next secondary destination:", source.planet.id);
            return source.planet;
        } else {
            // return base planet if no secondary destination could be found
            console.log("...next secondary destination: base => ", aps.base.id);
            return aps.base;
        }
    }
}; // called by APS
DistributorAPS.prototype.getSources = function(aps, pdC) {
    console.log("DistributorAPS.getSources:");
    if (typeof pdC === "undefined") pdC = aps.destinationColony;
    let potColonies = [];
    let here2sinkTurnDist = Math.ceil(aps.getDistance(pdC.planet, false) / aps.simpleRange);
    let scopeTurnDist = Math.ceil(aps.scopeRange / aps.simpleRange);
    // if we are at site, or are within the scope of the site
    if ((aps.planet && aps.planet.id === pdC.planet.id) || here2sinkTurnDist <= scopeTurnDist) {
        this.setScopeRange(aps);
        let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
        console.log("...found %s potential sources within %s lys:", targetsInRange.length, aps.scopeRange, targetsInRange);
        //
        if (targetsInRange.length > 0) {
            targetsInRange.forEach(
                function (t, index) {
                    let curC = autopilot.getColony(t.pid, true);
                    curC.distance2APS = aps.getDistance(curC.planet);
                    curC.distance2Sink = autopilot.getDistance(curC.planet, pdC.planet);
                    if (curC.isDistributorSource(aps, pdC) && curC.determineSafety()) potColonies.push( curC );
                }
            );
        }
    } else { // if we are somewhere else...
        vgap.myplanets.forEach(
            function (p, index) {
                if ((aps.planet && p.id === aps.planet.id) || p.id === pdC.id) return; // skip current and destination planet
                let src2sinkTurnDist = Math.ceil(autopilot.getDistance( p, pdC.planet, false ) / aps.simpleRange);
                //console.log("Turn distance from source %s to sink: %s", p.id, src2sinkTurnDist);
                let curC = autopilot.getColony(p.id, true);
                curC.distance2APS = aps.getDistance(curC.planet);
                curC.distance2Sink = autopilot.getDistance(curC.planet, pdC.planet);
                if (src2sinkTurnDist <= here2sinkTurnDist && curC.isDistributorSource(aps, pdC) && curC.determineSafety()) potColonies.push( curC );
            }
        );
    }
    return potColonies;
};
DistributorAPS.prototype.getClassifiedSources = function(aps, sources, demands) {
    console.log("DistributorAPS.getClassifiedSources:", aps.destinationColony);
    if (typeof demands === "undefined") demands = aps.demand.getApsDemand(aps);
    console.log("...distributor Demands:", demands);
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
DistributorAPS.prototype.pickSource = function(aps, pdC, excludePlanet, demands) {
    console.log("DistributorAPS.pickSource:");
    if (typeof pdC === "undefined") pdC = aps.destinationColony;
    if (typeof excludePlanet === "undefined") excludePlanet = false;
    if (typeof demands === "undefined") demands = aps.demand.getApsDemand(aps);
    let source = false;
    let potColonies = this.getSources(aps, pdC);
    console.log("...potColonies:", potColonies);
    if (potColonies.length > 0) {
        if (potColonies.length > 1) {
            let finalSourceCollection = this.getClassifiedSources(aps, potColonies, demands);
            console.log("...finalSourceCollection:", finalSourceCollection);

            for (let i = 0; i < finalSourceCollection.length; i++) {
                if (this.hasMissionConflict(aps, finalSourceCollection[i].planet, true)) continue;
                if (excludePlanet && excludePlanet.id === finalSourceCollection[i].planet.id) continue;
                return finalSourceCollection[i];
            }
        } else {
            if (excludePlanet && excludePlanet.id === potColonies[0].planet.id) return false;
            if (!this.hasMissionConflict(aps, potColonies[0].planet, true)) return potColonies[0];
        }
    }
    return source;
};

DistributorAPS.prototype.setPotentialWaypoints = function(aps) {
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
}; // called by APS

DistributorAPS.prototype.postActivationHook = function (aps) {

}; // called by APS
/*
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
ExpanderAPS.prototype.initialLoading = function(aps) {
    console.log(aps.demand);
    if (aps.colony.isAPSSource(aps)) { // is there something available we need?
        aps.unload();
        if (aps.demand.getApsDemand(aps).length > 0) {
            this.loadCargo(aps); // load cargo
        } else {
            console.error("No demand at destination!");
            return -1;
        }
    }
    return aps.demand.getApsDemand(aps).length;
};
ExpanderAPS.prototype.handleCargo = function (aps) {
    console.log("ExpanderAPS.handleCargo:");
    if (aps.planet && !aps.colony.isOwnPlanet) {
        // = new colony
        let enemyAtPlanet = autopilot.enemyShipAtPlanet(aps.planet);
        console.log("...enemyAtPlanet: " + enemyAtPlanet);
        if (!enemyAtPlanet) {
            aps.unload();
            if (!this.hasExpKit(aps)) {
                this.setSecondaryDestination(aps, false);
                if (aps.secondaryDestination && (aps.ship.targetx !== aps.secondaryDestination.x || aps.ship.targety !== aps.secondaryDestination.y)) aps.setShipTarget(); // re-set target if necessary
            }
        }
    } else if (aps.planet && aps.colony.isOwnPlanet) { // base, transit or secondary destination planet
        if (this.loadCargo(aps)) {
            // ok, we got expander Kit(s)
            if (aps.secondaryDestination && aps.secondaryDestination.id !== aps.planet.id) {
                aps.secondaryDestination = false;
                aps.secondaryDestinationColony = false;
            }
        } else {
            this.setSources(aps);
            if (this.sources.length > 0) {
                aps.secondaryDestination = vgap.getPlanet(this.sources[0].pid);
                aps.secondaryDestinationColony = autopilot.myColonies.findById(this.sources[0].pid);
            } else {
                aps.secondaryDestination = false;
                aps.secondaryDestinationColony = false;
                aps.setShipIdleStatus( { isIdle: true, idleReason: "Source/NA", idleTurns: 0 } );
            }
        }
    }
};
ExpanderAPS.prototype.setPotentialDestinations = function(aps)
{
    console.log("ExpanderAPS.setPotentialDestinations:");
    this.setSinks(aps);
    if (this.sinks.length === 0)
    {
        console.warn("...no potential destinations available!");
        aps.setShipIdleStatus( { isIdle: true, idleReason: "dest", idleTurns: 0 } );
    } else
    {
        aps.potDest = this.sinks;
        aps.isIdle = false;

    }
    console.log("...", aps.potDest);
};
ExpanderAPS.prototype.setSecondaryDestination = function(aps) {
    // check if cargo or planet contains expanderKit
    let planetKit = false;
    if (aps.planet) {
        planetKit = this.planetHasExpKit(aps);
    }
    if (!this.hasExpKit(aps) && !planetKit) {
        console.log("...insufficient cargo!");
        // unload remaining cargo to planet
        this.transferCargo(aps, true);
        // we are lacking something, set closest source as secondary destination
        // - only planets that are not destination of another aps that will pickup material we need
        this.setSources(aps);
        if (this.sources.length > 0) {
            aps.secondaryDestination = vgap.getPlanet(this.sources[0].pid);
            console.log("...secondary destination (" + aps.secondaryDestination.id + ") set.");
        } else {
            // no secondary destination (sufficient source) found
            console.error("...couldn't find an adequate secondary destination.");
            // get the next ETA waypoint
            let nextWaypoint = aps.getEtaWaypoint(aps.base); // toDo: this can be a very slow solution, since the smallest ETA is always first
            if (nextWaypoint) {
                aps.secondaryDestination = nextWaypoint;
            } else {
                aps.secondaryDestination = aps.base;
                let cP = autopilot.getClosestPlanet(aps.ship, 1, false);
                if (cP) aps.secondaryDestination = cP.planet;
            }
        }
    }
};
ExpanderAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets.concat(autopilot.frnnUnownedPlanets);
};
ExpanderAPS.prototype.validateMissionDestinations = function(aps) {
    let self = this;
    aps.potDest = aps.potDest.filter(function (pC) {
        return !self.hasMissionConflict(aps, pC.planet);
    });
};
ExpanderAPS.prototype.hasMissionConflict = function(aps, potPlanet) {
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS) {
        console.log("ExpanderAPS.hasMissionConflict:");
        console.log("..." + conflictAPS.length + " other " + aps.primaryFunction + " APS approaching " + potPlanet.id);
        return true;
    }
    let apsAtPlanet = autopilot.getAPSatPlanet(potPlanet);
    if (apsAtPlanet.length > 0) {
        //console.log(apsAtPlanet);
        let expanderAtPlanet = apsAtPlanet.filter(function (cfg) {
            console.log(aps.ship.id);
            return (cfg.shipFunction === "exp" && cfg.sid !== aps.ship.id);
        });
        if (expanderAtPlanet) {
            console.log("ExpanderAPS.hasMissionConflict:");
            console.log("..." + expanderAtPlanet.length + " other ExpanderAPS at " + potPlanet.id);
            return true;
        }
    }
    return false;
};
ExpanderAPS.prototype.confirmMission = function (aps)
{
    if (aps.isOwnPlanet) {
        if (aps.ship.friendlycode === "bdm") aps.ship.friendlycode = "xdm";
        if (aps.ship.mission === 10) aps.ship.mission = aps.oShipMission;
    }
    if (this.hasMissionConflict(aps, aps.destination)) {
        autopilot.setupAPS(aps.ship.id, false);
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
ExpanderAPS.prototype.getClassifiedSinks = function(aps, potSinks) {
    console.log("ExpanderAPS.getClassifiedSinks:");
    let classified = [];
    let withNatives = potSinks.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    console.log("...withNatives:", withNatives);
    let temperate = potSinks.filter(function (c) {
        return c.planet.temp > 14 && c.planet.temp < 85 && c.planet.nativeclans === 0;
    });
    console.log("...temperate:", temperate);
    let others = potSinks.filter(function (c) {
        return (c.planet.temp <= 14 || c.planet.temp >= 85) && c.planet.nativeclans === 0;
    });
    console.log("...others:", others);
    let unexplored = potSinks.filter(function (c) {
        return c.planet.temp === -1;
    });
    console.log("...unexplored:", unexplored);
    let amorphous = potSinks.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename === "Amorphous";
    });
    console.log("...amorphous:", amorphous);
    if (aps.planet && aps.planet.id === aps.base.id) {
        classified = classified.concat(withNatives, temperate);
    }
    if (aps.objectOfInterest === "fst") {
        classified = classified.concat(unexplored, others);
    } else {
        classified = classified.concat(unexplored, others, amorphous);
    }
    return classified;
};
ExpanderAPS.prototype.setSinks = function(aps)
{
    console.log("ExpanderAPS.setSinks:");
    this.setScopeRange(aps);
    let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnUnownedPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    console.log("...targets in scope range:", targetsInRange);
    let potColonies = [];
    let self = this;
    targetsInRange.forEach(function (pos) {
        let c = autopilot.getColony(pos.id, true);
        c.distance2Aps = c.getDistance(aps.ship);
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
            if (colShips.length > 0) {
                colShips.forEach(function (s) {
                    if (s.targetx === pos.x && s.targety === pos.y) willBcolonized = true;
                });
            }
        }
        if (!self.hasMissionConflict(aps, c.planet) && c.determineSafety() && !willBcolonized) potColonies.push(c);
    });
    potColonies.sort(function (a, b) {
        return a.distance2Aps - b.distance2Aps;
    });
    console.log("...potential colonies:", potColonies);
    let futureColonies = this.getClassifiedSinks(aps, potColonies);
    if (futureColonies.length > 0) {
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
    console.log("ExpanderAPS.setSources:");
    let expanderCargo = this.getExpanderKit(aps, true);
    let potSources = [];
    let goodSources = [];
    vgap.myplanets.forEach(function (p) {
        let c = autopilot.getColony(p.id, true);
        if (c.isExpanderSource(aps)) {
            c.distance2APS = Math.floor(autopilot.getDistance(c.planet, aps.ship));
            if (aps.planet && aps.planet.id === c.planet.id) {
                // we only look for sources, if the aps.planet does not offer anything, so we can exclude this colony (c) as potential source
            } else
            {
                potSources.push(c);
            }
        }
    });
    this.sources = potSources;
    this.sources.sort(function(a, b) { return a.distance2APS - b.distance2APS});
    console.log("...potential sources:", this.sources);
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
        clans = Math.floor(0.75 * aps.getCurCapacity());
    } else
    {
        // default on exploration: Clans / cargo = 50 % / 50 %
        // MDSF = 100 clans, 100 supply, 300 MC
        //
        clans = Math.floor(0.50 * aps.getCurCapacity());
    }
    let sups = aps.getCurCapacity() - clans;
    let mcs = 3 * (aps.getCurCapacity() - clans);
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
    return false;
};
ExpanderAPS.prototype.loadCargo = function(aps)
{
    let curCargo = 0;
    let loadedSups = 0;
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
            loadedSups += aps.loadObject("supplies", aps.planet, (kDiffSup*-1));
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
            let amorphousModifier = 0;
            if (aps.planet.nativeracename === "Amorphous") {
                amorphousModifier = 5;
                if (aps.planet.nativehappypoints < 90) amorphousModifier += 90 - aps.planet.nativehappypoints;
            }
            if (vgap.player.raceid === 7) { // crystals
                let popGrowth = (aps.planet.temp / 100 * maxAmounts[1] / 20 * 5 / 5) - amorphousModifier;
                if (popGrowth < 1) {
                    let newAmount = maxAmounts[1];
                    while (popGrowth < 1) {
                        newAmount += 1;
                        popGrowth = (aps.planet.temp / 100 * newAmount / 20 * 5 / 5) - amorphousModifier;
                    }
                    if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
                }
            } else {
                if (aps.planet.temp > 15 && aps.planet.temp < 84) {
                    let popGrowth = (aps.planet.temp * aps.planet.temp / 4000 * maxAmounts[1] / 20 * 5 / 5) - amorphousModifier;
                    if (popGrowth < 1) {
                        let newAmount = maxAmounts[1];
                        while (popGrowth < 1) {
                            newAmount += 1;
                            popGrowth = (aps.planet.temp * aps.planet.temp / 4000 * newAmount / 20 * 5 / 5) - amorphousModifier;
                        }
                        if (newAmount > maxAmounts[1]) maxAmounts[1] = newAmount;
                    }
                }
            }
        }
        //
        for (let i = 0; i < unloadingSequence.length; i++) {
            let cargo = unloadingSequence[i];
            let amount = maxAmounts[i];
            if (parseInt(aps.ship[cargo]) <= amount) {
                amount = parseInt(aps.ship[cargo]);
            }
            if (cargo !== "megacredits") aps.transferObject(cargo, aps.planet, amount);
        }
        if (aps.ship.megacredits > 0 && aps.planet.nativeclans < 1) {
            if (aps.ship.megacredits > 30) {
                aps.ship.friendlycode = "bd3";
            } else {
                aps.ship.friendlycode = "bdm";
            }
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
    console.log("HizzzAPS.handleCargo:");
    if (aps.planet && aps.isOwnPlanet)
    {
        if (aps.atBase) { // we are at base (sink)
            aps.unloadAll();
        } else { // source or waypoint
            let weLoad = true;
            let weUnload = true;
            let uniqueBaseIds = 0;
            let otherHizzers = aps.destinationHasSameAPStype(aps.planet.id); // returns stored data for APS that also have planet as destination with the same mission
            if (otherHizzers.length > 0) {
                let baseIds = otherHizzers.map(function (aps) {
                    return aps.base;
                });
                uniqueBaseIds = [...new Set(baseIds)]; // this APS will load a maximum of 1 / uniqueBaseIds of the cash.
                //
                // check if other ship has better engines or lower id
                //console.log("Current Hizzer %s with engineId %s?", aps.ship.id, aps.ship.engineid);
                let otherHizzerShipsByBase = {};
                otherHizzers.forEach(function (cfg) {
                    let s = vgap.getShip(cfg.sid);
                    if (s.x === aps.ship.x && s.y === aps.ship.y) { // at the current planet?
                        if (typeof otherHizzerShipsByBase[cfg.base] === "undefined")
                        {
                            otherHizzerShipsByBase[cfg.base] = [ s ];
                        } else
                        {
                            otherHizzerShipsByBase[cfg.base].push(s);
                        }
                    }
                });
                let otherHizzerShips = otherHizzerShipsByBase[aps.base.id];
                console.log("...other Hizzers:", otherHizzerShips);
                if (otherHizzerShips)
                {
                    let engineids = otherHizzerShips.map(function (s) {
                        return s.engineid;
                    });
                    engineids.push(aps.ship.engineid);
                    let uniqueEngines = [...new Set(engineids)];
                    //console.log("uniqueEngines", uniqueEngines);
                    if (uniqueEngines.length > 1)
                    {
                        otherHizzerShips.sort(function (a, b) {
                            return b.engineid - a.engineid;
                        });
                        //console.log("sorted other Hizzers", otherHizzerShips);
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
                let loadLog = this.loadCargo(aps, uniqueBaseIds.length);
                console.log("...we are loading:", loadLog);
                if (aps.planet.id === aps.destination.id && this.missionCompleted(aps))
                {
                    aps.destination = aps.base;
                }
            } else
            {
                if (weUnload)
                {
                    console.log("...we are unloading");
                    aps.unload();
                }
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
    if (aps.atBase && this.getBetterPotentialSources(aps)) {
        // if we are at base (sink), set sources as potential destinations
        console.log("...for hizzer at base (sink)...");
        aps.potDest = this.sources;
        if (aps.potDest.length === 0 && (aps.colony.natPotRevenue > 1000 || (aps.colony.planet.nativeclans > 0 && aps.colony.planet.nativehappypoints < 100))) {
            aps.potDest = [ aps.colony ];
        }
    } else {
        // set base as only potential destination, if we are at a source
        console.log("...for hizzer at a (source) planet...");
        aps.potDest = this.sinks;
    }
    if (aps.potDest.length === 0) {
        console.log("...no destinations available...");
    } else {
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
HizzzAPS.prototype.validateMissionDestinations = function(aps) {
    console.log("...filtering HIZZER destinations: " + aps.potDest.length);
    //console.log(aps.potDest);
    aps.potDest = aps.potDest.filter(function (c) {
        //if (c.planet.id !== aps.base.id) return !c.isBuildingBase && !c.hasStarbase; // ??? what the heck
        return true;
    });
};
HizzzAPS.prototype.hasMissionConflict = function(aps, potPlanet)
{
    let conflictAPS = aps.destinationHasSameAPStype(potPlanet.id); // returns stored data for APS that also visit potPlanet with the same mission
    if (conflictAPS) {
        console.log("There are %s Hizzzer at planet %s", conflictAPS.length, potPlanet.id);
        //
        // compare true revenue with potential revenue
        let c = autopilot.getColony(potPlanet.id);
        let trueRevenue = c.getRevenue();
        let potentialRevenue = c.getRevenue(c.taxation, true);
        let diff = trueRevenue / potentialRevenue;
        console.log("The planet's true revenue %s vs. the planet's potential revenue %s", trueRevenue, potentialRevenue);
        if (diff < 0.5) return conflictAPS.length >= 6; // allow only half of max hizzers (so the deficiency of clans won't be too extreme?)
        //
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
    if (aps.planet && aps.base.id === aps.planet.id) {
        return true; // this.getBetterPotentialSources(aps);
    } else {
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
HizzzAPS.prototype.loadCargo = function(aps, devisor)
{
    console.log("HizzzAPS.loadCargo:");
    if (aps.destination.id === aps.planet.id || aps.planet.id === aps.lastDestination.id) // destination = planet that is being hizzed
    {
        if (typeof devisor === "undefined") devisor = 1;
        let curC = autopilot.getColony(aps.planet.id, true);
        if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid")) curC.sellSupply(true);
        //
        let toLoad = Math.floor(curC.balance.megacredits / devisor);
        if (devisor > 1 && aps.megacredits >= aps.minCapacity || aps.targetIsSet()) // don't load if we already have minCapacity reached or if we are already going back to base (and thus have loaded during initialization and no longer are registered as APS with same target)
        {
            toLoad = 0;
        }
        console.log("...loading:", toLoad);
        let loaded = aps.loadObject("megacredits", aps.planet, toLoad);
        return { item: "megacredits", value: loaded };
    } else
    {
        // always collect cash from intermediate stops, as long as there is no starbase
        // toDo: not all starbases need cash...?
        let curC = autopilot.getColony(aps.planet.id, true);
        if (!curC.hasStarbase)
        {
            if (this.sellSupply === true || (this.sellSupply === "notBov" && aps.planet.nativeracename !== "Bovinoid")) curC.sellSupply(true);
            let loaded = aps.loadObject("megacredits", aps.planet, curC.balance.megacredits);
            return { item: "megacredits", value: loaded };
        }
    }
};
HizzzAPS.prototype.setSinks = function(aps) {
    // as hizzzer, the base is always the sink
    this.sinks = [ autopilot.getColony(aps.base.id) ];
};
HizzzAPS.prototype.setScopeRange = function(aps) {
    console.log("hizzer scope Range:", aps.scopeRange);
    let inRange = aps.getAPSinRange(aps.scopeRange);
    if (inRange && inRange.length > 3) {
        aps.scopeRange *= 3;
    } else {
        aps.scopeRange *= 2;
    }
};
HizzzAPS.prototype.getBetterPotentialSources = function(aps) {
    console.log("HizzzAPS.getBetterPotentialSources:");
    let self = this;
    return this.sources.filter(function (ps) {
        let newRevenue = ps.getRevenue(ps.taxation, false, 1); // true revenue with one more hizzer
        return ps.determineSafety() && ps.planet.id !== aps.planet.id && newRevenue > aps.colony.revenue && !self.hasMissionConflict(aps, ps.planet);
    });
};
HizzzAPS.prototype.getSources = function(aps) {
    console.log("HizzzAPS.getSources:");
    this.setScopeRange(aps);
    let potColonies = [];
    if (aps.ship.engineid < 6) return [ aps.colony ]; // don't look for other sources if we don't have "good" engines
    let planetsInRange = [];
    if (aps.planet && aps.planet.id === aps.base.id) planetsInRange.push(aps.planet); // add base planet if we are at base
    planetsInRange = planetsInRange.concat(autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, aps.base.x, aps.base.y, aps.scopeRange));
    console.log("...targets in range:", planetsInRange);
    let self = this;
    planetsInRange.forEach(function (p) {
        let curC = autopilot.getColony(p.id);
        curC.distance2APS = aps.getDistance(p);
        curC.eta2Source = Math.floor(aps.getDistance(p) / aps.simpleRange);
        if (curC.isHizzzerSource(aps) && !self.hasMissionConflict(aps, curC.planet)) potColonies.push(curC);
    });
    console.log("...potential targets:", potColonies);
    return potColonies;
};
HizzzAPS.prototype.setSources = function(aps)
{
    console.log("HizzzAPS.setSources:");
    // as hizzzer, each planet with taxable population is a source
    // and the object of interest is to produce MCs and transport them to the base
    // priority are planets that generate most MCs
    let potColonies = this.getSources(aps);
    let maxIncome = potColonies.filter(function (c) {
        return c.potRevenue === c.maxIncome;
    });
    maxIncome.sort(function (a, b) {
        return a.distance2APS - b.distance2APS;
    });
    console.log("...maxIncome sources:", maxIncome);
    let others = potColonies.filter(function (c) {
        return c.potRevenue < c.maxIncome;
    });
    others.sort(function (a, b) {
        return b.potRevenue - a.potRevenue;
    });
    console.log("...other sources:", maxIncome);

    this.sources = [].concat(maxIncome, others);
    console.log("...sources:", this.sources);
};
HizzzAPS.prototype.isSource = function(planet)
{
    let c = autopilot.getColony(planet.id);
    return (c.getRevenue() > 100);
};
HizzzAPS.prototype.transferCargo = function(aps)
{

};
/*
 *  nuPilot - Terraform Module
 *
 *
 */
function TerraformerAPS() {
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
TerraformerAPS.prototype.setPotentialDestinations = function(aps) {
    console.log("TerraformerAPS.setPotentialDestinations:");
    this.setSinks(aps);
    if (aps.colony.getTerraformDeficiency(aps) < 0) {
        console.log("...status: " + aps.colony.getTerraformDeficiency(aps));
        if (this.sinks.length > 0) {
            console.log("...best other target status: " + this.sinks[0].climateDeficiency);
            if (aps.colony.climate === "arctic" || aps.colony.climate === "desert") return; // dont't go anywhere if current planet is an extreme planet
            if (this.sinks[0].climate !== "arctic" && this.sinks[0].climate !== "desert") return; // don't go anywhere unless best other target is a extreme planet
        }
    }
    if (this.sinks.length === 0) {
        console.warn("...no potential destinations available!");
        aps.isIdle = true;
        if (aps.idleReason.indexOf("Dest") === -1) aps.idleReason.push("Dest");
    } else {
        aps.potDest = this.sinks;
        aps.isIdle = false;
    }
    console.log("...", aps.potDest);
};
TerraformerAPS.prototype.setSecondaryDestination = function(aps)
{
    //aps.secondaryDestination = false;
};
TerraformerAPS.prototype.setPotentialWaypoints = function(aps)
{
    aps.potentialWaypoints = autopilot.frnnOwnPlanets;
};
TerraformerAPS.prototype.validateMissionDestinations = function(aps)
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
TerraformerAPS.prototype.missionCompleted = function(aps) {
    // terraformer does not use secondary destination.
    // Heating or cooling of a planet is the mission
    // Thus, mission is completed, if current destination does not need cooling or heating
    if (aps.destinationColony) {
        return aps.destinationColony.getTerraformDeficiency(aps) === 0;
    } else {
        return aps.colony.getTerraformDeficiency(aps) === 0;
    }
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
TerraformerAPS.prototype.setSinks = function(aps) {
    // as terraformer, each planet with a temperature other than the optimal is a sink
    // and the object of interest usually is nothing else than terraform
    // however, if it would be known that there are natives (bioscan) priority could be used for those planets
    // the same goes for planets where the resources are known
    // priority should be given to extreme planets (i.e. colder than 15° C and hotter than 84° C) toDo: unless we are crystal... and natives are not harmed
    this.setScopeRange(aps);
    console.log("..setting potential terraforming targets");
    let targetsInRange = autopilot.getTargetsInRange(autopilot.frnnPlanets, aps.ship.x, aps.ship.y, aps.scopeRange);
    //targetsInRange.push(aps.planet); // add current planet
    let pCs = [];
    let self = this;
    targetsInRange.forEach(function (pos) {
        let p = vgap.planetAt(pos.x, pos.y);
        let c = autopilot.getColony(p.id);
        c.climateDeficiency = c.getTerraformDeficiency(aps);
        if (c.climateDeficiency < 0) pCs.push(c);
    });
    console.log("...targets in scope range: " + targetsInRange.length + " (" + (aps.scopeRange) + ")");
    // EMERGENCIES
    let emergencies = pCs.filter(function (c) {
        return c.climate === "arctic" || c.climate === "desert";
    }); // extreme limiting conditions
    if (vgap.player.raceid === 7) {
        emergencies = pCs.filter(function (c) {
            return c.climate === "arctic";
        }); // crystal, only arctic planets
    }
    let pool = [];

    if (emergencies.length > 0) {
        pool = emergencies;
    } else {
        pool = pCs;
    }

    let withNatives = pool.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    withNatives.sort(function (a, b) {
        return b.climateDeficiency - a.climateDeficiency;
    });
    //
    let potential = pCs.filter(function (c) {
        return c.planet.nativeclans === 0;
    });
    potential.sort(function (a, b) {
        return b.climateDeficiency - a.climateDeficiency;
    });
    //
    let amorph = pCs.filter(function (c) {
        return c.planet.nativeclans > 0 && c.planet.nativeracename !== "Amorphous";
    });
    //
    console.log("... native targets: " + withNatives.length);
    console.log("... potential targets: " + potential.length);
    console.log("... amorph targets: " + amorph.length);
    //
    this.sinks = withNatives.concat(potential);
    if (this.sinks.length < 1 && amorph.length > 0) {
        this.sinks = amorph;
    }
    console.log(this.sinks);
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
    resources: ["neutronium", "duranium", "tritanium", "molybdenum", "clans", "megacredits", "supplies"],
    apsOOItext: {
        col: {
            neu: "neutronium",
            dur: "duranium",
            tri: "tritanium",
            mol: "molybdenum",
            cla: "clans",
            mcs: "megacredits",
            sup: "supplies",
            name: "collecting"
        },
        dis: {
            neu: "fuel",
            mcs: "megacredits",
            cla: "clans",
            name: "distributing"
        },
        bld: {
            bab: "starbase",
            stb: "planetary structures",
            shb: "ships",
            fib: "fighter",
            name: "building"
        },
        exp: {
            fst: "planet",
            slw: "planet",
            name: "colonizing"
        },
        ter: {
            cla: "planet",
            name: "terraforming"
        },
        hiz: {
            mcs: "planet",
            name: "hizzzing"
        },
        alc: {
            all: "minerals",
            dur: "duranium",
            tri: "tritanium",
            mol: "molybdenum",
            neu: "fuel",
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
    myColoniesIndex: false,
    myColonies: false,
    localPlaneteerIndex: false,
    planeteers: false,
    localApsIndex: false,
    apsShips: false,
    myShips: false,
    myHulls: false,
    //
    globalMinerals: {},
    mineralMaxis: {},
    //
    towedShips: [],                 // IDs of towed (my)ships
    chunnelShips: [],               // IDs of ships that will be chunnel
    robbedShips: [],                // IDs of ships that have been robbed
    oofShips: [],                   // IDs of ships that are out of fuel (Crystal player)
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
        console.warn("autopilot.scanReports:");
        // check messages for combat reports where APS might have been destroyed...
        // this is necessary due to the recycling of shipIDs
        vgap.messages.forEach(function (msg)
        {
            //console.log(msg);

            if (msg.messagetype === 12) {
                if (autopilot.oofShips.indexOf(msg.target) === -1)
                {
                    console.log("...adding ship to oof-list", msg);
                    autopilot.oofShips.push(msg.target);
                }
            }
            if (msg.body.match(/has been destroyed/) !== null)
            {
                if (msg.ownerid === vgap.player.id)
                {
                    console.warn("...one of our ships has been destroyed!", msg);
                    // if target is a APS, delete local storage entry
                    let apsData = autopilot.shipIsAps(msg.target);
                    if (apsData) {
                        console.warn("...the ship is an APS...");
                        autopilot.apsShips.deactivate(msg.target);
                        autopilot.apsShips.save();
                    }
                }
            } else if (msg.body.match(/have been robbed/) !== null)
            {
                console.warn("...one of our ships has been robbed!", msg);
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
        console.log("autopilot.planetaryManagement:");
        autopilot.initGlobalMinerals();
        autopilot.initMineralMaxis();
        autopilot.initMyColonies();
        autopilot.updateMyColonies();
    },
    initMyColonies: function()
    {
        console.log("autopilot.initMyColonies:");
        let localPlaneteers = autopilot.loadPlaneteerData();
        console.log("...loaded planetary manager settings:", localPlaneteers);
        //
        autopilot.myColonies = new autopilot.myColoniesIndex([]);
        for (let i = 0; i < vgap.myplanets.length; i++)
        {
            const p = vgap.myplanets[i];
            //autopilot.planeteers.push({ pid: p.id }); // make sure we have a default entry for the colony
            autopilot.myColonies.push(new Colony(p.id, true)); // initialize colony + building
            let c = autopilot.myColonies.findById(p.id);
            //c.updateBalance();
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
        console.log("...initialized colonies & global minerals.");
        //console.log(autopilot.globalMinerals);
    },
    updateMyColonies: function()
    {
        autopilot.myColonies.forEach(function (c) {
            c.update()
        });
    },
    getColony: function(id, updateBalance) {
        if (typeof updateBalance === "undefined") updateBalance = false;
        let c = autopilot.myColonies.findById(id);
        if (c) {
            c.update();
            if (updateBalance) c.updateBalance();
        } else {
            autopilot.myColonies.push(new Colony(id, true));
        }
        return autopilot.myColonies.findById(id);
    },
    getStarbaseColonies: function() {
        return autopilot.myColonies.filter(function (c) {
            if (c.hasStarbase && !c.isFort) {
                c.updateBalance();
                if (!c.mineralsInRange) c.setMineralsInRange();
            }
            return c.hasStarbase && !c.isFort;
        });
    },
    getStructureBuildingColonies: function()
    {
        return autopilot.myColonies.filter(function (c) {
            if (c.isBuildingStructures && vgap.shipsAt(c.planet.x, c.planet.y).length > 0) c.updateBalance();
            return (c.isOwnPlanet && c.isBuildingStructures);
        });
    },
    getStarbaseDevelopingColonies: function() {
        return autopilot.myColonies.filter(function (c) {
            if (c.isBuildingBase || (c. hasStarbase && c.isFort)) {
                //if (vgap.shipsAt(c.planet.x, c.planet.y).length > 0)
                c.updateBalance();
                c.setMineralsInRange();
            }
            return c.isBuildingBase || (c. hasStarbase && c.isFort);
        });
    },
    getSinkColonies: function(aps)
    {
        let obj = aps.moveablesMap[aps.objectOfInterest];
        return autopilot.myColonies.filter(function (c) {
            if (c.isSink[obj]) {
                return true;
            } else {
                c.updateBalance();
                return c.isSink[obj];
            }
        });
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
     *  initShipControl:
     *      - starts INITIAL PHASE for all APS and sets note color
     *      - init localApsIndex (autopilot.apsShips)
     *      - init myShipsIndex (autopilot.myShips)
     */
    initShipControl: function()
    {
        console.log("autopilot.initShipControl:");
        // APS - Initial setup...
        autopilot.myShips = new autopilot.myShipsIndex(vgap.myships);
        let apsControl = [];
        autopilot.apsShips = new autopilot.localApsIndex([]);
        let localApsShips = autopilot.loadLocalApsData();
        if (localApsShips) {
            localApsShips.forEach(function (apsData) {
                let s = vgap.getShip(apsData.sid); // check if ship still exists
                if (s) {
                    autopilot.apsShips.push(apsData);
                    let aps = new APS(s, apsData); // INITIAL PHASE
                    if (aps.isAPS) apsControl.push(aps); // add APS to APS-list
                }
            });
        }
        console.log("...loaded apsShips settings:", autopilot.apsShips);
        //
        return apsControl;
    },
    /*
     *  APS Toolbox
     */
    setupAPS: function(shipId, cfgData) {
        if (typeof cfgData === "undefined") {
            cfgData = autopilot.shipIsAps(shipId); // false if not in storage
            console.error("Retry setting up APS " + shipId);
        } else {
            console.error("Setting up new APS " + shipId);
        }

        let ship = vgap.getShip(shipId);
        let aps = new APS(ship, cfgData); // INITIAL PHASE
        if (aps.isAPS) {
            if (aps.hasToSetPotDes) {
                console.warn("=> SET POTENTIAL DESTINATIONS: APS " + aps.ship.id);
                autopilot.populateFrnnCollections();
                aps.functionModule.setPotentialDestinations(aps); // PHASE 1
                if (aps.potDest.length > 0) {
                    console.warn("SET MISSION DESTINSTION: APS " + aps.ship.id);
                    aps.setMissionDestination(); // PHASE 2
                }
            }
            if (!aps.isIdle) {
                console.warn("CONFIRM MISSION: APS " + aps.ship.id);
                aps.confirmMission(); // PHASE 3
                if (typeof aps.functionModule.postActivationHook === "function") aps.functionModule.postActivationHook(aps);
            }
            aps.updateStoredData();
        } else {
            aps.updateNote();
        }
    },
    getAPSatPlanet: function(planet) {
        let apsAt = [];
        if (autopilot.apsShips.findByPlanet(planet.id)) return autopilot.apsShips.findByPlanet(planet.id);
        return apsAt;
    },
    getAPSwithDestination: function(p, secondary) {
        if (typeof secondary === "undefined") secondary = false;
        let apsWithDest = [];
        if (!secondary) apsWithDest = autopilot.apsShips.findByDestination(p.id);
        if (secondary) apsWithDest = autopilot.apsShips.findBySecondaryDestination(p.id);
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
    planetIsInStorage: function(planetId)
    {
        if (autopilot.planeteers.findById(planetId))
        {
            return autopilot.planeteers.findById(planetId);
        } else {
            let newPlaneteer = new APPdata({ pid: planetId });
            autopilot.planeteers.push(newPlaneteer.getData());
            return newPlaneteer;
        }
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
    //
    shipIsAps: function(shipId) {
        //if (!autopilot.apsShips) autopilot.initShipControl();
        let aps = autopilot.apsShips.findById(shipId);
        if (aps) return aps;
        return false;
    },
    loadLocalApsData: function(initDataEntry) {
        let storedGameData = JSON.parse(localStorage.getItem(autopilot.storageId));
        if (storedGameData === null) {
            // try old storageId
            storedGameData = JSON.parse(localStorage.getItem(autopilot.oldStorageId));
            if (storedGameData === null) {
                if (typeof initDataEntry === "undefined") return false;
                let gdo = new APSdata(initDataEntry);
                let gameData = gdo.getData();
                if (gameData) {
                    storedGameData = [];
                    storedGameData.push(gameData);
                    localStorage.setItem(autopilot.storageId, JSON.stringify(storedGameData));
                    return storedGameData;
                } else {
                    return false;
                }
            } else {
                return storedGameData;
            }
        } else {
            return storedGameData;
        }
    },
    behaviourHasToChange: function(current, future) {
        return (current.shipFunction !== future.shipFunction || current.ooiPriority !== future.ooiPriority);
    },
    syncLocalApsStorage: function(data) {

    },
    //
    loadPlaneteerData: function() {
        console.log("autopilot.loadPlaneteerData:");
        let storedPlaneteerData = JSON.parse(localStorage.getItem(autopilot.pStorageId));
        console.log("...planeteerData:", storedPlaneteerData);
        if (storedPlaneteerData === null) {
            autopilot.planeteers = new autopilot.localPlaneteerIndex([]);
            vgap.myplanets.forEach(function (p) {
                let pd = new APPdata({ pid: p.id });
                autopilot.planeteers.push(pd.getData());
            });
            autopilot.planeteers.save();
        } else {
            autopilot.planeteers = new autopilot.localPlaneteerIndex(storedPlaneteerData);
        }
        return autopilot.planeteers;
    },
    savePlaneteerData: function(planetData) {
        //console.log("savePlaneteerData");
        localStorage.setItem(autopilot.pStorageId, JSON.stringify(planetData));
    },
    /*
     *  DATA COLLECTIONS
     */
    populateFrnnCollections: function() {
        //console.log("autopilot.populateFrnnCollections:");
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
            if (minefield.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(minefield.ownerid)) {
                if (minefield.isweb) {
                    autopilot.frnnEnemyWebMinefields.push( minefield );
                } else {
                    autopilot.frnnEnemyMinefields.push( minefield );
                }
            } else {
                if (minefield.isweb) {
                    autopilot.frnnFriendlyWebMinefields.push( minefield );
                } else {
                    autopilot.frnnFriendlyMinefields.push( minefield );
                }
            }
        });
    },
    populateFrnnShips: function()
    {
        autopilot.frnnEnemyShips = [];
        vgap.ships.forEach(function(ship) {
            if (ship.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(ship.ownerid)) autopilot.frnnEnemyShips.push(ship);
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
    populateHullCollection: function() {
        let raceHulls = vgap.race.hulls.split(",");
        raceHulls = raceHulls.map(function (hid) {
            return parseInt(hid);
        });
        autopilot.myHulls = vgap.hulls.filter(function (h) {
            return raceHulls.indexOf(h.id) > -1;
        });
        console.log("...autopilot.myHulls", autopilot.myHulls);
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
                let cfgData = autopilot.shipIsAps(ship.id);
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
            if (ship.hullid === 56) {
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
            } // firecloud
            //console.log("ship %s is being towed", ship.id, autopilot.myShips.getTowedIds().indexOf(ship.id));
            if ((ship.warp === 0 || !autopilot.shipTargetIsSet(ship) || autopilot.shipIsWellBouncing(ship)) && autopilot.myShips.getTowedIds().indexOf(ship.id) === -1 && autopilot.myShips.getChunneldIds().indexOf(ship.id) === -1) {
                let cfgData = autopilot.shipIsAps(ship.id);
                // exclude
                //      a) active alchemy ships,
                //      b) ships building fighters (only ships with stardrive),
                //      c) ships being cloned
                //
                if ((cfgData && !cfgData.idle && (cfgData.shipFunction === "alc" || cfgData.shipFunction === "ter" || cfgData.shipFunction === "hiz" || (cfgData.shipFunction === "bld" && cfgData.ooiPriority === "fib"))) ||
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
    getDistance: function(p1, p2, exact) {
        if (typeof exact === "undefined") exact = true;
        let originIsPlanet = vgap.planetAt(p1.x, p1.y);
        let destIsPlanet = vgap.planetAt(p2.x, p2.y);
        let dist = Math.sqrt((Math.pow((parseInt(p1.x) - parseInt(p2.x)), 2) + Math.pow((parseInt(p1.y) - parseInt(p2.y)), 2)));
        if (!exact && originIsPlanet && dist >= 2.2) dist -= 2.2;
        if (!exact && destIsPlanet && dist >= 2.2) dist -= 2.2;
        return dist;
    },
    getTargetsInRange: function(coords, x, y, r) {
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
    isFriendlyPlayer: function(playerId) {
        for (let i = 0; i < vgap.relations.length; i++) {
            if (vgap.relations[i].playertoid === playerId) {
                return (vgap.relations[i].relationto >= 2 || vgap.relations[i].relationfrom >= 2);
            }
        }
    },
    objectIsInside: function(object, inside)
    {
        if (typeof object === "undefined" || typeof inside === "undefined") return false;
        let hits = inside.filter(function (item) {
            let curDistToItemCenter = Math.floor(autopilot.getDistance(item, object));
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
        //console.log("autopilot.objectInside:", object, inside);
        let hits = [];
        for (let i = 0; i < inside.length; i++)
        {
            let curDistToMinefieldCenter = Math.floor(autopilot.getDistance(inside[i], object));
            if (inside[i].radius > curDistToMinefieldCenter) hits.push(inside[i]);
        }
        //console.log("...", (hits.length > 0));
        return hits;
    },
    getObjectsInRangeOf: function(objects, range, of) {
        let objectsInRange = [];
        for (let j = 0; j < objects.length; j++) {
            let dist = Math.floor(autopilot.getDistance(objects[j], of));
            if (dist <= range) objectsInRange.push(objects[j]);
        }
        return objectsInRange;
    },
    objectCloseTo: function(object, closeTo, r) {
        let targets = autopilot.getTargetsInRange(closeTo, object.x, object.y, r);
        return targets.length > 0;
    },
    objectInsideEnemyMineField: function(object)
    {
        return autopilot.objectInside(object, autopilot.frnnEnemyMinefields);
    },
    objectInsideEnemyWebMineField: function(object)
    {
        return autopilot.objectInside(object, autopilot.frnnEnemyWebMinefields);
    },
    objectInsideStarCluster: function(object)
    {
        if (typeof object === "undefined") return false;
        let sc = vgap.stars;
        let inside = [];
        for (let i = 0; i < sc.length; i++) {
            let curDistToStarClusterCenter = autopilot.getDistance(sc[i], object);
            let radiationradius = Math.sqrt(sc[i].mass);
            if (radiationradius > curDistToStarClusterCenter) {
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
            let curDistToIonStormCenter = Math.floor(autopilot.getDistance(ionStorms[i], object));
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
    shipIsArmed: function(s)
    {
        let shipHull = vgap.getHull(s.hullid);
        return (shipHull.beams > 0 || shipHull.fighterbays > 0 || shipHull.launchers > 0);
    },
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
            hullCargoMass += scargo.reduce(function(total, value) { return total + parseInt(value); });
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
            hullCargoMass += components.reduce(function(total, value) { return total + parseInt(value); });
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
        if (typeof distance === "undefined") distance = Math.ceil(autopilot.getDistance( ship, { x: ship.targetx, y: ship.targety } ));
        if (typeof cargo === "undefined") cargo = [];
        let hullCargoMass = autopilot.getHullCargoMass(sid, cargo); // without fueltank content, if cargo is an empty array, current ship cargo is used
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
    shipTargetIsSet: function(ship) {
        return (ship.x !== ship.targetx || ship.y !== ship.targety);
    },
    getNonAPSatPlanet: function(planet)
    {
        let nonAPS = [];
        let shipsAt = vgap.shipsAt(planet.x, planet.y);
        //console.log("...found " + shipsAt.length + " ships at planet...");
        for (let i = 0; i < shipsAt.length; i++)
        {
            let sData = autopilot.shipIsAps(shipsAt[i].id);
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
        let cC = autopilot.getColony(planet.id);
        let cP = false;
        if (cC.neighbours) cP = cC.neighbours[0];
        let distance = 81;
        if (cP) distance = Math.ceil(autopilot.getDistance( planet, cP.planet ));
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
        let distance = Math.ceil(autopilot.getDistance( position, planet ));
        return (distance <= 3);
    },
    getCurCapacity: function(s, obj)
    {
        if (obj === "neutronium")
        {
            const hull = vgap.getHull(s.hullid);
            return hull.fueltank - s.neutronium;
        } else if (obj === "megacredits")
        {
            return 10000 - s.megacredits;
        } else
        {
            return autopilot.getCurCargoCapacity(s);
        }
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
    getTorpShips: function(p) {
        let torpers = [];
        let localShips = autopilot.myShips.findByPlanet(p.id);
        if (localShips && localShips.length > 0) {
            localShips.forEach(function (s) {
                if (s.torps > 0 && s.targetx === s.x && s.targety === s.y) torpers.push(s);
            });
        }
        let incommingShips = autopilot.myShips.findByTargetPlanet(p.id);
        if (incommingShips && incommingShips.length > 0) {
            incommingShips.forEach(function (s) {
                if (s.torps > 0) torpers.push(s);
            });
        }
        return torpers;
    },
    getLFMships: function(p)
    {
        let lfm = [];
        if (vgap.player.raceid === 9 || vgap.player.raceid === 10 || vgap.player.raceid === 11)
        {
            let localShips = autopilot.myShips.findByPlanet(p.id);
            if (localShips && localShips.length > 0) {
                localShips.forEach(function (s) {
                    if (s.friendlycode.toLowerCase() === "lfm" && s.targetx === s.x && s.targety === s.y) lfm.push(s);
                });
            }
            let incommingShips = autopilot.myShips.findByTargetPlanet(p.id);
            if (incommingShips && incommingShips.length > 0) {
                incommingShips.forEach(function (s) {
                    if (s.friendlycode.toLowerCase() === "lfm") lfm.push(s);
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
        console.log("autopilot.getSumOfObjectInRange:");
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
        let total = amounts.reduce(function (total, amount) {
            return total + amount;
        });
        console.log("...amounts and total:", amounts, total);
        return total;
    },
    getSumOfAvailableObjectInRange: function(center, range, object, includePotential)
    {
        if (typeof includePotential === "undefined") includePotential = false;
        let planetsInRange = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, center.x, center.y, range);
        let coloniesInRange = planetsInRange.map(function (p) {
            return autopilot.myColonies.findById(p.id);
        });
        let regularColonies = coloniesInRange.filter(function (c) {
            return !c.isBuildingBase && (!c.hasStarbase || c.hasStarbase && c.isFort);
        });
        let amounts = regularColonies.map(function (c) {
            //c.updateBalance();
            if (autopilot.isMineral(object) && includePotential) {
                return c.planet[object] + c.planet["ground" + object];
            } else {
                return c.planet[object];
            }
        });
        //console.log("amounts", amounts);
        if (amounts.length > 0) {
            return amounts.reduce(function (total, amount) {
                return total + amount;
            });
        } else {
            return 0;
        }
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
    getClosestPlanet: function(coords, candidates, fromAll)
    {
        //console.log("autopilot.getClosestPlanet:");
        if (typeof coords === "undefined") return false;
        if (typeof candidates === "undefined") candidates = 1;
        if (typeof fromAll === "undefined") fromAll = false;
        let closestPlanets = false;
        let potentialPlanets = autopilot.getTargetsInRange(autopilot.frnnOwnPlanets, coords.x, coords.y, 200);
        if (fromAll) potentialPlanets = autopilot.getTargetsInRange(autopilot.frnnPlanets, coords.x, coords.y, 200);
        let planets = potentialPlanets.map(function (p) {
            let distance = Math.ceil(autopilot.getDistance( p, coords ));
            return { planet: vgap.getPlanet(p.id), distance: distance };
        });
        planets.sort(function (a, b) {
            return a.distance - b.distance;
        });
        if (planets.length > 0) {
            if (candidates === 1)
            {
                closestPlanets = planets[0];
            } else {
                closestPlanets = planets.slice(0, candidates);
            }
        }
        //console.log("...closestPlanet:", closestPlanets);
        return closestPlanets;
    },
    /*
     * DRAWING
     */
    // draw: executed on any click or drag on the starmap
    draw: function() {
        //console.log("Draw: plugin called.");
        autopilot.towedShips = [];
        for (let i = 0; i < vgap.myships.length; i++) {
            let s = vgap.myships[i];
            if (s.mission === 6 && autopilot.towedShips.indexOf(s.mission1target) === -1) autopilot.towedShips.push(s.mission1target);
        }
        for (let i = 0; i < vgap.myships.length; i++) {
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
    processload: function() {
        console.log(vgap);
        autopilot.setupStorage(); // local storage setup
        autopilot.loadGameSettings();
        // setup indexed Arrays (PROXY)
        autopilot.myColoniesIndex = new Proxy(Array, {
            construct: function (target, [oArray]) {
                const index = {};
                oArray.forEach(function (item) {
                    index[item.id] = item;
                });

                const newArray = new target(...oArray);

                return new Proxy(newArray, {
                    get: function (target, name) {
                        if (name === "push") {
                            return function (item) {
                                index[item.id] = item;
                                return target[name].call(target, item);
                            }
                        } else if (name === "findById") {
                            return function (id) {
                                return index[id];
                            }
                        } else if (name === "updateBalance") {
                            return function (id, prop, diff) {
                                let c = index[id];
                                if (autopilot.resources.indexOf(prop) > -1) {
                                    console.log("...updating balance of colony %d.", id, diff);
                                }
                                c.balance[prop] += diff;
                            }
                        }
                        return target[name];
                    }
                })
            }
        });
        autopilot.localPlaneteerIndex = new Proxy(Array, {
            construct: function (target, [oArray]) {
                const index = {};
                const pidIdx = [];
                oArray.forEach(function (item) {
                    index[item.pid] = item;
                    pidIdx.push(item.pid);
                });

                const newArray = new target(...oArray);

                return new Proxy(newArray, {
                    get: function (target, name) {
                        if (name === "push") {
                            return function (item) {
                                if (pidIdx.indexOf(item.pid) === -1) {
                                    index[item.pid] = item;
                                    pidIdx.push(item.pid);
                                    return target[name].call(target, item);
                                }
                            }
                        } else if (name === "findById") {
                            return function (pid) {
                                if (typeof index[pid] === "undefined") return false;
                                return index[pid];
                            }
                        } else if (name === "update") {
                            return function (pid, data) {
                                if (typeof index[pid] === "undefined") return false;
                                index[pid] = data;
                                newArray[pidIdx.indexOf(pid)] = data;
                            }
                        } else if (name === "save") {
                            return function () {
                                console.log("...saving", newArray);
                                localStorage.setItem(autopilot.pStorageId, JSON.stringify(newArray));
                            }
                        } else if (name === "deactivate") {
                            return function (pid, section) {
                                if (typeof index[pid] === "undefined") return true;
                                if (section === "taxation")
                                {
                                    let p = vgap.getPlanet(pid);
                                    p.colonisttaxrate = 0;
                                    p.nativetaxrate = 0;
                                }
                                newArray[pidIdx.indexOf(pid)][section] = "off";
                                localStorage.setItem(autopilot.pStorageId, JSON.stringify(newArray));
                            }
                        } else {
                            return target[name];
                        }
                    }
                })
            }
        });
        autopilot.localApsIndex = new Proxy(Array, {
            construct: function (target, [oArray]) {
                const index = {};
                const sidIdx = [];
                const bidIdx = [];
                const destIndex = {};
                const secDestIndex = {};
                const locationIndex = {};
                oArray.forEach(function (item) {
                    index[item.sid] = item;
                    sidIdx.push(item.sid);
                    if (item.base && bidIdx.indexOf(item.base) === -1) bidIdx.push(item.base);
                    if (typeof destIndex[item.destination] === "undefined") {
                        destIndex[item.destination] = [ item ];
                    } else {
                        destIndex[item.destination].push(item);
                    }
                    if (typeof secDestIndex[item.secondaryDestination] === "undefined") {
                        secDestIndex[item.secondaryDestination] = [ item ];
                    } else {
                        secDestIndex[item.secondaryDestination].push(item);
                    }
                    let s = vgap.getShip(item.sid);
                    if (s) {
                        let p = vgap.planetAt(s.x, s.y);
                        if (p) {
                            if (typeof locationIndex[p.id] === "undefined") {
                                locationIndex[p.id] = [ item ];
                            } else {
                                locationIndex[p.id].push(item);
                            }
                        }
                    }
                });

                const newArray = new target(...oArray);

                return new Proxy(newArray, {
                    get: function (target, name) {
                        if (name === "push") {
                            return function (item) {
                                if (sidIdx.indexOf(item.sid) === -1) {
                                    index[item.sid] = item;
                                    sidIdx.push(item.sid);
                                    if (item.base && bidIdx.indexOf(item.base) === -1) bidIdx.push(item.base);
                                    if (typeof destIndex[item.destination] === "undefined") {
                                        destIndex[item.destination] = [ item ];
                                    } else {
                                        destIndex[item.destination].push(item);
                                    }
                                    if (typeof secDestIndex[item.secondaryDestination] === "undefined") {
                                        secDestIndex[item.secondaryDestination] = [ item ];
                                    } else {
                                        secDestIndex[item.secondaryDestination].push(item);
                                    }
                                    let s = vgap.getShip(item.sid);
                                    if (s) {
                                        let p = vgap.planetAt(s.x, s.y);
                                        if (p) {
                                            if (typeof locationIndex[p.id] === "undefined") {
                                                locationIndex[p.id] = [ item ];
                                            } else {
                                                locationIndex[p.id].push(item);
                                            }
                                        }
                                    }
                                    return target[name].call(target, item);
                                }
                            }
                        } else if (name === "getBaseIdx") {
                            return function () {
                                return bidIdx;
                            }
                        } else if (name === "findById") {
                            return function (sid) {
                                if (typeof index[sid] === "undefined") return false;
                                return index[sid];
                            }
                        } else if (name === "findByDestination") {
                            return function (destId) {
                                //console.log("...destinationIndex:", destIndex[destId]);
                                if (typeof destIndex[destId] === "undefined") return [];
                                return destIndex[destId];
                            }
                        } else if (name === "findBySecondaryDestination") {
                            return function (secDestId) {
                                if (typeof secDestIndex[secDestId] === "undefined") return [];
                                return secDestIndex[secDestId];
                            }
                        } else if (name === "findByPlanet") {
                            return function (pid) {
                                if (typeof locationIndex[pid] === "undefined") return [];
                                return locationIndex[pid];
                            }
                        } else if (name === "deactivate") {
                            return function (sid) {
                                if (typeof index[sid] === "undefined") return true;
                                delete index[sid];
                                newArray.splice(sidIdx.indexOf(sid), 1);
                                sidIdx.splice(sidIdx.indexOf(sid), 1);
                                let note = vgap.getNote(sid, 2);
                                if (note) note.body = "";
                                let ship = vgap.getShip(sid);
                                ship.targetx = ship.x;
                                ship.targety = ship.y;
                                ship.target = false;
                                if (vgap.planetAt(ship.x, ship.y)) ship.target = vgap.planetAt(ship.x, ship.y)
                            }
                        } else if (name === "update") {
                            return function (sid, data) {
                                index[sid] = data;
                                newArray[sidIdx.indexOf(sid)] = data;
                            }
                        } else if (name === "save") {
                            return function () {
                                console.log("...saving", newArray);
                                localStorage.setItem(autopilot.storageId, JSON.stringify(newArray));
                            }
                        } else {
                            return target[name];
                        }
                    }
                })
            }
        });
        // toDo: proxy all vgap.myships (vgap.myships.forEach(function(s){ s = new proxy... }))
        autopilot.myShipsIndex = new Proxy(Array, {
            construct: function (target, [oArray]) {
                const index = {};
                const locationIndex = {};
                const targetIndex = {};
                const towedIdIndex = [];
                const chunneldIdIndex = [];
                oArray.forEach(function (item) {
                    index[item.id] = item;
                    if (item.mission === 6 && towedIdIndex.indexOf(item.mission1target) === -1) towedIdIndex.push(item.mission1target);
                    if (item.hullid === 56 && item.warp === 0) {
                        // Firecloud at warp 0
                        if (item.friendlycode.match(/\d\d\d/) && item.neutronium > 49) {
                            // initiating a chunnel ?
                            // check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                            let receiver = vgap.getShip(item.friendlycode);
                            if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== item.x || receiver.y !== item.y)) {
                                let ships = vgap.shipsAt(item.x, item.y);
                                if (ships) {
                                    for( let i = 0; i < ships.length; i++) {
                                        if ((ships[i].targetx === ships[i].x && ships[i].targety === ships[i].y) || ships[i].warp === 0) {
                                            if (chunneldIdIndex.indexOf(ships[i].id) === -1) chunneldIdIndex.push(ships[i].id); // add ship to chunnel-ship-list
                                        }
                                    }
                                }
                            } else {
                                item.friendlycode = "00c";
                            }
                        } else {
                            let inList = chunneldIdIndex.indexOf(item.id);
                            if (inList > -1) {
                                chunneldIdIndex.splice(inList, 1);
                                if (item.friendlycode.match(/\d\d\d/)) item.friendlycode = "00c";
                            }
                        }
                    } else if (item.hullid === 56 && item.warp > 0) {
                        if (item.friendlycode === "00c") item.friendlycode = "abc";
                    }
                    let p = vgap.planetAt(item.x, item.y);
                    if (p) {
                        if (typeof locationIndex[p.id] === "undefined") {
                            locationIndex[p.id] = [ item ];
                        } else {
                            locationIndex[p.id].push(item);
                        }
                    }
                    let tp = vgap.planetAt(item.targetx, item.targety);
                    if (tp) {
                        if (typeof targetIndex[tp.id] === "undefined") {
                            targetIndex[tp.id] = [ item ];
                        } else {
                            targetIndex[tp.id].push(item);
                        }
                    }
                    //console.log("towedIdIndex", towedIdIndex);
                });

                const newArray = new target(...oArray);

                return new Proxy(newArray, {
                    get: function (target, name) {
                        if (name === "push") {
                            return function (item) {
                                if (index.indexOf(item.id) === -1) {
                                    index[item.id] = item;
                                    if (item.mission === 6 && towedIdIndex.indexOf(item.mission1target) === -1) towedIdIndex.push(item.mission1target);
                                    if (item.hullid === 56 && item.warp === 0) {
                                        // Firecloud at warp 0
                                        if (item.friendlycode.match(/\d\d\d/) && item.neutronium > 49) {
                                            // initiating a chunnel ? check if the receiver can be reached (warp 0, with at least 1 fuel) and is not at the same position
                                            let receiver = vgap.getShip(item.friendlycode);
                                            if (receiver && receiver.warp === 0 && receiver.neutronium > 0 && (receiver.x !== item.x || receiver.y !== item.y)) {
                                                let ships = vgap.shipsAt(item.x, item.y);
                                                if (ships) {
                                                    for( let i = 0; i < ships.length; i++) {
                                                        if ((ships[i].targetx === ships[i].x && ships[i].targety === ships[i].y) || ships[i].warp === 0) {
                                                            if (chunneldIdIndex.indexOf(ships[i].id) === -1) chunneldIdIndex.push(ships[i].id);
                                                        }
                                                    }
                                                }
                                            } else {
                                                item.friendlycode = "00c";
                                            }
                                        } else {
                                            let inList = chunneldIdIndex.indexOf(item.id);
                                            if (inList > -1) {
                                                chunneldIdIndex.splice(inList, 1);
                                                if (item.friendlycode.match(/\d\d\d/)) item.friendlycode = "00c";
                                            }
                                        }
                                    } else if (item.hullid === 56 && item.warp > 0) {
                                        if (item.friendlycode === "00c") item.friendlycode = "abc";
                                    }
                                    let p = vgap.planetAt(item.x, item.y);
                                    if (p) {
                                        if (typeof locationIndex[p.id] === "undefined") {
                                            locationIndex[p.id] = [ item ];
                                        } else {
                                            locationIndex[p.id].push(item);
                                        }
                                    }
                                    let tp = vgap.planetAt(item.targetx, item.targety);
                                    if (tp) {
                                        if (typeof targetIndex[tp.id] === "undefined") {
                                            targetIndex[tp.id] = [ item ];
                                        } else {
                                            targetIndex[tp.id].push(item);
                                        }
                                    }
                                    return target[name].call(target, item);
                                }
                            }
                        } else if (name === "findById") {
                            return function (id) {
                                return index[id];
                            }
                        } else if (name === "findByPlanet") {
                            return function (pid) {
                                return locationIndex[pid];
                            }
                        } else if (name === "findByTargetPlanet") {
                            return function (pid) {
                                return targetIndex[pid];
                            }
                        } else if (name === "getTowedIds") {
                            return function () {
                                return towedIdIndex;
                            }
                        } else if (name === "getChunneldIds") {
                            return function () {
                                return chunneldIdIndex;
                            }
                        } else if (name === "update") {
                            return function (ship) {
                                if (towedIdIndex.indexOf(ship.id) > -1 && ship.mission !== 6) towedIdIndex.splice(towedIdIndex.indexOf(ship.id),1);
                            }
                        } else if (name === "set") {
                            return function (id, prop, value) {
                                let s = index[id];
                                if (prop === "mission1target") {
                                    console.log("...old mission1target %d vs. new mission1target %d %s:", s[prop], value, prop);
                                    if (s.mission === 6 && value === 0) {
                                        let towedIdx = towedIdIndex.indexOf(value);
                                        towedIdIndex.splice(towedIdx, 1);
                                    } else if (s.mission === 6 && towedIdIndex.indexOf(value) === -1) towedIdIndex.push(value);
                                } else if (prop === "mission") {
                                    if (s.mission === 6 && s.mission1target !== 0)  { // cancel tow...
                                        let towedIdx = towedIdIndex.indexOf(s.mission1target);
                                        towedIdIndex.splice(towedIdx, 1);
                                    }
                                } else if (autopilot.resources.indexOf(prop) > -1) {
                                    console.log("...setting resource %s of ship...", prop);
                                    let p = vgap.planetAt(s.x ,s.y);
                                    if (p) {
                                        let diff = value - s[prop];
                                        //autopilot.myColonies.updateBalance(p.id, prop, diff);
                                    }
                                } else if (prop === "targetx") {
                                    if (s.mission === 6 && s.mission1target !== 0)  { // cancel tow...
                                        let towedIdx = towedIdIndex.indexOf(s.mission1target);
                                        towedIdIndex.splice(towedIdx, 1);
                                    }
                                }
                                s[prop] = value;
                            }
                        } else {
                            return target[name];
                        }
                    },
                    set: function (obj, prop, value) {
                        console.log('...setting %s to %s...', prop, value, obj);
                    }
                })
            }
        });
        autopilot.demandIndex = new Proxy(Array, {
            construct: function (target, [oArray]) {
                const index = {};
                oArray.forEach(function (demand) {
                    index[demand.item] = demand;
                });
                const newArray = new target(...oArray);
                return new Proxy(newArray, {
                    get: function (target, name) {
                        if (name === "push") {
                            return function (demand) {
                                if (index.indexOf(demand.item) === -1) {
                                    index[demand.item] = demand;
                                    return target[name].call(target, demand);
                                }
                            }
                        } else if (name === "findByResourceName") {
                            return function (name) {
                                if (typeof index[name] === "undefined") return 0;
                                return index[name].value;
                            }
                        } else if (name === "getApsDemand") {
                            return function (aps) {
                                let returnDemand = [];
                                let cargoCapacity = aps.getCurCapacity();
                                let nettoDemand = newArray.map(function (d) {
                                    return { item: d.item, value: (d.value - aps.ship[d.item]) };
                                });
                                let remainingDemand = nettoDemand.filter(function (d) {
                                    return d.value > 0;
                                });
                                let mcDemand = remainingDemand.filter(function(d) { return d.item === "megacredits" });
                                if (mcDemand.length > 0) {
                                    let mcValue = 10000 - aps.ship.megacredits;
                                    if (mcValue > index.megacredits.value) mcValue = index.megacredits.value;
                                    returnDemand.push( { item: "megacredits", value: mcValue } );
                                }
                                let fuelDemand = remainingDemand.filter(function(d) { return d.item === "neutronium" });
                                if (fuelDemand.length > 0) {
                                    let fuelValue = aps.hull.fueltank - aps.ship.neutronium;
                                    if (fuelValue > index.neutronium.value) fuelValue = index.neutronium.value;
                                    returnDemand.push( { item: "neutronium", value: fuelValue } );
                                }
                                let cargoDemand = remainingDemand.filter(function(d) { return d.item !== "megacredits" && d.item !== "neutronium" });
                                if (cargoDemand.length > 0) {
                                    let demandCargo = cargoDemand.reduce(function (total, d) {
                                        return total + d.value;
                                    });
                                    if (demandCargo >= cargoCapacity) {
                                        let ratioDemand = cargoDemand.map(function (d) {
                                            return { item: d.item, value: Math.round(d.value / demandCargo) * cargoCapacity, ratio: Math.round(d.value / demandCargo) };
                                        });
                                        returnDemand = returnDemand.concat(ratioDemand);
                                    } else {
                                        returnDemand = returnDemand.concat(cargoDemand);
                                    }
                                }
                                return new autopilot.demandIndex(returnDemand);
                            }
                        } else if (name === "containFuel") {
                            return function() {
                                return Object.keys(index).indexOf("neutronium") > -1;
                            }
                        } else if (name === "containMoney") {
                            return function() {
                                return Object.keys(index).indexOf("megacredits") > -1;
                            }
                        } else if (name === "containCargo") {
                            return function() {
                                return (Object.keys(index).indexOf("duranium") > -1 || Object.keys(index).indexOf("tritanium") > -1 || Object.keys(index).indexOf("molybdenum") > -1 ||
                                    Object.keys(index).indexOf("clans") > -1 || Object.keys(index).indexOf("supplies") > -1);
                            }
                        } else {
                            return target[name];
                        }
                    }
                })
            }
        });

        if (!vgap.inHistory) // only act, when we are in the present!
        {
            autopilot.populateFrnnCollections();
            autopilot.populateHullCollection();
            autopilot.populateShipCollections();
            //
            autopilot.planetaryManagement(); // myplanets -> colony -> set build targets according to planet mineral values, build structures, set taxes, set resource balance (deficiency / request & excess)
            //autopilot.populateMineralMaxis(); // now included in planetaryManagement
            //
            // APSs initial setup
            let apsControl = autopilot.initShipControl(); // INITIAL PHASE
            //
            // APS that arrived at destination did unload their cargo...
            //
            autopilot.scanReports(); // check reports for destroyed vessels
            //
            //autopilot.planetaryManagement(); // e.g. update buildTargets & build ??
            //
            // APS without destination need to determine potential destinations
            //
            apsControl.forEach(function(shipcontrol) {
                if (shipcontrol.hasToSetPotDes) {
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
                if (shipcontrol.isIdle && shipcontrol.idleReason.indexOf("fuel") === -1) {
                    console.error("Retry idle ship " + shipcontrol.ship.id);
                    // no destination found... or no secondary destination found...
                    if (!shipcontrol.destination || (shipcontrol.destination && !shipcontrol.secondaryDestination)) {
                        console.warn("SET POTENTIAL DESTINATIONS: APS " + shipcontrol.ship.id);
                        shipcontrol.functionModule.setPotentialDestinations(shipcontrol);
                        if (shipcontrol.potDest.length > 0) {
                            console.warn("SET MISSION DESTINATION: APS " + shipcontrol.ship.id);
                            shipcontrol.setMissionDestination();
                        }
                    }

                    if (shipcontrol.destination) {
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
        let c = autopilot.myColonies.findById(vgap.planetScreen.planet.id);
        c.updateBalance(false);
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
        console.log(autopilot.myShips);
        vgap.shipScreen.ship = new Proxy(vgap.shipScreen.ship, {
            set: function(target, prop, value, receiver) {
                //console.log("Routing set %s through myships proxy...", prop, value, receiver);
                autopilot.myShips.set(target.id, prop, value);
                //console.log(autopilot.myShips.getTowedIds());
                return true;
            },
            get: function (target, name) {
                //if (name === "targetx" || name === "targety") console.log("Routing get %s through myships proxy...", name, target[name]);
                return target[name];
            }
        });
        let apsData = autopilot.shipIsAps(vgap.shipScreen.ship.id);
        if (apsData && apsData.idle) {
            console.log("Ship idle status: " + apsData.idle);
            autopilot.setupAPS(vgap.shipScreen.ship.id, apsData);
        }
        console.log(vgap.shipScreen.ship);
    }
};
/*
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
    this.sbDefCosts = {
        defense: {
            duranium: 1,
            megacredits: 10
        },
        fighters: {
            tritanium: 3,
            molybdenum: 2,
            megacredits: 100
        }
    };
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
    this.balanceChanged = false;
    this.isSink = {
        clans: false,
        neutronium: false
    };
    //
    this.pid = pid;
    this.id = pid;
    this.planet = this.getPlanet(pid);
    this.climate = this.getClimate(pid);
    this.settings = this.getSettings(pid);
    this.neighbours = false;
    this.owner = this.getPlanetOwner();
    this.hasStarbase = vgap.getStarbase(pid);
    this.isOwnPlanet = (this.planet && this.planet.ownerid === vgap.player.id);
    this.isBuildingBase = this.isBuildingStarbase();
    this.isFort = this.isFortifying(); // a purely defensive base
    this.isFortified = this.getFortStatus(); // a purely defensive base
    this.isSellingSupply = this.getSellingSupply();
    this.isBuildingStructures = this.getBuildingStructures();
    this.hasTecRace = this.nativesAreTecRace();
    this.withStrandedAPS = false;
    this.mineralProduction = this.getMineralProduction();
    this.taxation = "default";
    //  APS Helper Attributes
    this.sourceType = [];
    this.isFuelSink = false;
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
        this.setNeighbours();
        this.safetyStatus = false;
        this.hasSpecialShips = this.getSpecialShips();
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
        this.potRevenue = this.getRevenue(undefined, true);
        this.colRevenue = this.getIncomeFromColonists();
        this.natRevenue = this.getIncomeFromNatives(undefined, false);
        this.natPotRevenue = this.getIncomeFromNatives();
        this.optNatTaxClans = this.getOptNatTaxClans();
        this.optBovSupClans = this.getOptBovSupClans();
        //
        this.k75Minerals = this.getMineralClassStatus(); // surface minerals, 75th percentile
        this.k50Minerals = this.getMineralClassStatus("ground", 50);
        this.mineralsInRange = false;
        this.structures = this.getStructures();
        //
        if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.setBuildTargets();
        this.optLabor = this.getOptLabor();
        if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildStructures();
        if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildSbDefense();
        if (autopilot.settings.planetMNG && build && this.isSellingSupply) this.sellSupply();
        this.setMeanMineralDepletion(); // independent of this.mineralProduction
        //
        if (autopilot.settings.planetMNG) this.setTaxes();
        this.update(pid, build);
    }
}
/*
    AUTORUN
 */
Colony.prototype.updateBalance = function(withShipDemands) {
    if (typeof withShipDemands === "undefined") withShipDemands = true;
    // called after APS loading and unloading, from autopilot.planetaryManagement->initMyColonies
    //console.log("Colony.updateBalance:");
    this.balance = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0,
        supplies: 0,
        megacredits: 0,
        clans: 0
    };
    this.setPlanetDeficiency(withShipDemands);
    //
    if (this.hasStarbase) {
        this.setStarbaseDeficiency();
    }
    if (this.isFort) { // planets with or without starbase but set to fortify
        this.setFortMineralExcess();
    }
    this.isSink.clans = this.balance.clans < 0;
    this.isSink.neutronium = this.balance.neutronium < 0;
};
Colony.prototype.drawIndicators = function() {
    if (this.hasStarbase || this.isBuildingBase) this.drawStarbaseIndicators(); // map indicator
    if (this.isFort) this.drawFortIndicators();
    this.drawTaxMissionIndicator();
    this.drawMineralValueIndicator();
    this.drawMineralDetailIndicator();
    this.drawStructuresIndicator();
    this.drawNativeIndicators();
};
Colony.prototype.getPlanet = function(id) {
    //console.log("Colony.getPlanet:");
    let self = this;
    let p = vgap.getPlanet(id);
    //console.log("...planet", p);
    if (p) {
        return new Proxy(p, {
            set: function(target, prop, value, receiver) {
                if (prop === "colonisttaxrate" || prop === "nativetaxrate") {
                    if (target[prop] === value) return false;
                    //console.log("...old %d vs. new %d %s:", target[prop], value, prop);
                    target[prop] = value;
                    self.revenue = self.getRevenue();
                    //console.log("...updated revenue", self.revenue);
                } else {
                    target[prop] = value;
                }
                return true;
            }
        });
    } else {
        return false;
    }
};
Colony.prototype.getSettings = function(id) {
    let settings = autopilot.planeteers.findById(id);
    if (!settings) {
        let newSettings = new APPdata({ pid: id });
        autopilot.planeteers.push(newSettings.getData());
        autopilot.planeteers.save();
        settings = autopilot.planeteers.findById(id);
    }
    return settings;
};
Colony.prototype.setNeighbours = function() {
    if (!this.neighbours)
    {
        this.neighbours = autopilot.getClosestPlanet(this.planet, 3);
    }
};
Colony.prototype.getSpecialShips = function() {
    let specialShips = [];
    let specialShipIds = [
        104, // refinery
        105, // alchemy
    ];
    let ships = vgap.shipsAt(this.planet.x, this.planet.y);
    if (ships.length > 0)
    {
        ships.forEach(function (s) {
            if (specialShipIds.indexOf(s.hullid) > -1) specialShips.push(s);
        });
    }
    return specialShips;
};
/*
    GENERAL
 */
Colony.prototype.update = function(build) {
    if (typeof build === "undefined") build = false;
    this.settings = this.getSettings(this.planet.id);
    this.isBuildingBase = this.isBuildingStarbase();
    this.isFort = this.isFortifying(); // a purely defensive base
    this.isSellingSupply = this.getSellingSupply();
    this.isBuildingStructures = this.getBuildingStructures();
    this.k75Minerals = this.getMineralClassStatus(); // ground minerals, 75th percentile
    this.k50Minerals = this.getMineralClassStatus("ground", 50); // ground minerals, 50th percentile
    //
    if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.setBuildTargets();
    this.optLabor = this.getOptLabor();
    if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildStructures();
    if (autopilot.settings.planetMNG && build && this.isBuildingStructures) this.buildSbDefense();
    if (autopilot.settings.planetMNG && build && this.isSellingSupply) this.sellSupply();
    //i
    if (autopilot.settings.planetMNG) this.setTaxes();
};
Colony.prototype.getPlanetOwner = function() {
    return this.planet.ownerid > 0 ? vgap.players[this.planet.ownerid - 1].raceid : vgap.player.raceid;
};
Colony.prototype.getClimate = function() {
    if (this.planet.temp > 84) {
        return "desert";
    } else if (this.planet.temp > 60) {
        return "tropical";
    } else if (this.planet.temp > 39) {
        return "warm";
    } else if (this.planet.temp > 14) {
        return "cool";
    } else {
        return "arctic";
    }
};
Colony.prototype.getFleet = function() {
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
Colony.prototype.determineSafety = function() {
    let s = this.getSafetyStatus();
    let planetIsSafe = (s.enemyShips.length === 0 && s.enemyPlanets.length === 0) || s.ownShips.length > 0 || s.ownMinefields.length > 0;
    if (s.enemyMinefields.length > 0 || s.ionStormDanger || s.starclusters.length > 0) planetIsSafe = false; // always makes planet unsafe!
    //if (!planetIsSafe) console.log("Colony.determineSafety:", this.planet.id, planetIsSafe, s);
    return planetIsSafe;
};
Colony.prototype.isInsideFriendlyMinefield = function() {
    let friendlyMinefields = vgap.minefields.filter(function(mf) {
        return mf.ownerid === vgap.player.id || autopilot.isFriendlyPlayer(mf.ownerid);
    });
    return autopilot.objectInside(this.planet, friendlyMinefields);
};
Colony.prototype.isInsideEnemyMinefield = function() {
    let enemyMinefields = vgap.minefields.filter(function(mf) {
        return mf.ownerid !== vgap.player.id && !autopilot.isFriendlyPlayer(mf.ownerid);
    });
    return autopilot.objectInside(this.planet, enemyMinefields);
};
Colony.prototype.getSafetyStatus = function() {
    // ion storms
    let ionStorms = autopilot.objectInsideIonStorm(this.planet);
    let dangerousIonStorms = ionStorms.filter(function (s) {
        return (s.isgrowing && Math.floor(s.voltage * 1.2) >= 150) || s.voltage >= 150;
    });
    let cIsInDangerousIonstorm = dangerousIonStorms.length > 0;
    // starclusters
    let starclusters = autopilot.objectInsideStarCluster(this.planet);
    // mine fields
    let withinEnemyMinefield = this.isInsideEnemyMinefield();
    let protectedByMinefield = this.isInsideFriendlyMinefield();
    // enemy (ships & planets)
    let closeEnemyPlanets = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyPlanets, 81, this.planet);
    let closeEnemyShips = autopilot.getObjectsInRangeOf(autopilot.frnnEnemyShips, 81, this.planet);
    if (vgap.player.raceid === 7) { // Crystal, only consider ships with fuel
        closeEnemyShips = closeEnemyShips.filter(function (s) {
            return autopilot.oofShips.indexOf(s.id) === -1;
        });
    }
    closeEnemyShips = closeEnemyShips.filter(function (s) {
        return autopilot.shipIsArmed(s);
    });
    let ownShips = vgap.shipsAt(this.planet.x, this.planet.y);
    ownShips = ownShips.filter(function (s) {
        return s.ownerid === vgap.player.id;
    });
    if (ownShips.length > 0)
    {
        ownShips.filter(function (s) {
            return autopilot.shipIsArmed(s);
        });
    }
    this.safetyStatus = {
        ionStorms: ionStorms,
        ionStormDanger: cIsInDangerousIonstorm,
        starclusters: starclusters,
        enemyMinefields: withinEnemyMinefield,
        ownMinefields: protectedByMinefield,
        enemyPlanets: closeEnemyPlanets,
        enemyShips: closeEnemyShips,
        ownShips: ownShips
    };
    return this.safetyStatus;
};
/*
    POSITIONAL INFO
 */
Colony.prototype.getDistanceToEnemyPlanet = function() {
    let enemyPlanets = this.getCloseEnemyPlanets();
    if (enemyPlanets) {
        enemyPlanets.sort(function (a, b) { return a.distance - b.distance; });
        return enemyPlanets[0].distance;
    } else {
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
                closeEnemyPlanets[idx].distance = Math.floor(autopilot.getDistance( p, eP ));
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
Colony.prototype.setMineralsInRange = function() {
    this.mineralsInRange = {
        neutronium: autopilot.getSumOfAvailableObjectInRange(this.planet, 162, "neutronium"),
        duranium: autopilot.getSumOfAvailableObjectInRange(this.planet, 162, "duranium"),
        tritanium: autopilot.getSumOfAvailableObjectInRange(this.planet, 162, "tritanium"),
        molybdenum: autopilot.getSumOfAvailableObjectInRange(this.planet, 162, "molybdenum")
    };
};
Colony.prototype.setPlanetMineralExcess = function()
{
    let p = this.planet;
    this.balance.duranium += p.duranium;
    this.balance.tritanium += p.tritanium;
    this.balance.molybdenum += p.molybdenum;
};
Colony.prototype.setPlanetDeficiency = function(withShips) {
    this.balance.supplies = this.getSupplyDeficiency(); // needs to be calculated before megacredits, since supplies can be transformed to MCs
    this.balance.megacredits = this.getMcDeficiency();
    this.balance.clans = this.getClanDeficiency();
    this.balance.neutronium = this.getFuelDeficiency();
    if (this.isBuildingBase) this.setBaseBuildingDeficiency();
    //console.log("...1. balance:", this.balance);
    this.setPlanetMineralExcess();
    //console.log("...2. balance:", this.balance);
    if (withShips) this.setShipsResourceDemands();
    if (withShips) this.setShipsResourceDeliveries();
    //console.log("...final balance:", this.balance);
    this.setTransitFuelRequest();
};
Colony.prototype.setShipsResourceDeliveries = function() {
    this.setAPSresourceDeliveries();
    this.setShipResourceDeliveries();
};
Colony.prototype.setShipsResourceDemands = function() {
    let p = this.planet;
    let self = this;
    if (this.hasSpecialShips.length > 0) {
        this.hasSpecialShips.forEach(function (s) {
            if (s.hullid === 104)
            {
                self.balance.supplies -= 1050;
            } else if (s.hullid === 105) self.balance.supplies -= 2700;
        });
    }
    let lfmShips = autopilot.getLFMships(p);
    if (lfmShips.length > 0) {
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
    let torpShips = autopilot.getTorpShips(p);
    if (torpShips.length > 0) {
        let torpCost = [0,1,2,5,10,12,13,31,35,36,54];  // cost per torp by tec level
        torpShips.forEach(function (s) {
            let potentialTorps = autopilot.getCurCargoCapacity(s);
            if (potentialTorps > 0) {
                self.balance.duranium -= potentialTorps;
                self.balance.tritanium -= potentialTorps;
                self.balance.molybdenum -= potentialTorps;
                let curMaxTorps = [ self.planet.duranium, self.planet.tritanium, self.planet.molybdenum ];
                curMaxTorps.sort(function (a, b) {
                    return a - b;
                });
                self.balance.megacredits -= torpCost[s.torpedoid] * curMaxTorps[0]; // only request money for currently buildable torps
            }
        });
    }
    //
    if (!this.hasStarbase) {
        let damagedShips = autopilot.getDamagedShips(p);
        if (damagedShips.length > 0) {
            damagedShips.forEach(function (s) {
                if (s.damage > 0 && s.supplies < s.damage * 5) self.balance.supplies -= (s.damage * 5) - s.supplies;
            });
        }
    }
    this.setAPSresourceDemands();
    this.setStrandedAPSFuelDemand();
};
Colony.prototype.setStrandedAPSFuelDemand = function()
{
    let apsAtPlanet = autopilot.getAPSatPlanet(this.planet);
    if (apsAtPlanet.length > 0)
    {
        let strandedAPS = apsAtPlanet.filter(function (aps) {
            return aps.idle && aps.idleReason.indexOf("fuel") > -1;
        });
        if (strandedAPS.length > 0)
        {
            this.withStrandedAPS = true;
            let self = this;
            let fuelDemand = 0;
            strandedAPS.forEach(function (aps) {
                let s = vgap.getShip(aps.sid);
                let base = vgap.getPlanet(aps.base);
                let distance = autopilot.getDistance(self.planet, base);
                if (s.targetx !== s.x || s.targety !== s.y)
                {
                    distance = autopilot.getDistance(self.planet, {x: s.targetx, y: s.targety });
                }
                fuelDemand += autopilot.getOptimalFuelConsumptionEstimate(aps.sid, [], distance) - s.neutronium;
            });
        }
    }
};
Colony.prototype.setTransitFuelRequest = function()
{
    // check if ships are at planet...
    // For each ship, we request the amount necessary to fly to the closest neighbor planet.
    let p = this.planet;
    let ships = vgap.shipsAt(p.x, p.y);
    let closest = this.neighbours[0];
    if (closest)
    {
        for (let i = 0; i < ships.length; i++)
        {
            if (ships[i].ownerid !== vgap.player.id) continue;
            let cS = ships[i];
            let cRequest = Math.floor(autopilot.getOptimalFuelConsumptionEstimate(cS.id, [], closest.distance));
            //console.log(cRequest);
            let isAPS = autopilot.shipIsAps(cS.id);
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
Colony.prototype.setAPSresourceDemands = function() {
    let apsWithDemand = autopilot.getAPSwithDestination(this.planet, true); // with this colony as secondary destination = pick up
    if (apsWithDemand.length > 0) {
        //console.log("APS with possible demand: ", apsWithDemand);
        let self = this;
        apsWithDemand.forEach(function (aps) {
            const s = vgap.getShip(aps.sid);
            // only consider ships inbound, excluding those that are already here
            if ((s.x !== self.planet.x && s.y !== self.planet.y) && aps.shipFunction === "dis" || aps.shipFunction === "bld") {
                let curCapacity = autopilot.getCurCargoCapacity(s);
                let curMcCapacity = 10000 - s.megacredits;
                if (aps.destination) {
                    const dC = autopilot.getColony(aps.destination, true);
                    let demand = [];
                    if (aps.shipFunction === "dis") {
                        demand = dC.getDistributorDemand(aps.ooiPriority);
                    } else if (aps.shipFunction === "bld") {
                        demand = dC.getBuilderDemand(aps.ooiPriority, aps.sid);
                    }
                    //console.log("..considering demand:", dC.planet.id, demand);
                    if (demand.length > 0) {
                        demand.forEach(function (d) {
                            if (curCapacity && d.item !== "megacredits") {
                                let take = 0;
                                if (self.balance[d.item] > 0) {
                                    if (self.balance[d.item] >= d.value) {
                                        take = d.value;
                                    } else {
                                        take = self.balance[d.item];
                                    }
                                    if (curCapacity >= take) {
                                        self.balance[d.item] -= take;
                                        curCapacity -= take;
                                        //console.log("...reducing %s balance of Colony by %d", d.item, take);
                                    } else {
                                        self.balance[d.item] -= curCapacity;
                                        curCapacity = 0;
                                        //console.log("...reducing %s balance of Colony by %d", d.item, curCapacity);
                                    }
                                }
                            } else if (curMcCapacity && d.item === "megacredits") {
                                //console.log("Megacredit DEMAND:", d);
                                let take = 0;
                                if (self.balance[d.item] > 0) {
                                    if (self.balance[d.item] >= d.value) {
                                        take = d.value;
                                    } else {
                                        take = self.balance[d.item];
                                    }
                                    if (curMcCapacity >= take) {
                                        self.balance[d.item] -= take;
                                        curMcCapacity -= take;
                                    } else {
                                        self.balance[d.item] -= curMcCapacity;
                                        curMcCapacity = 0;
                                    }
                                }
                            }
                        });
                    }
                }
            }
        });
    }
};
Colony.prototype.addShipCargoToBalance = function(ship) {
    let resources = this.resources.filter(function (r) {
        return ship[r] > 0;
    });
    for (let i = 0; i < resources.length; i++) {
        //console.log("...adding %d %s to balance...", ship[resources[i]], resources[i]);
        this.balance[resources[i]] += ship[resources[i]];
    }
};
Colony.prototype.setAPSresourceDeliveries = function() {
    let apsWithDelivery = autopilot.getAPSwithDestination(this.planet); // with this colony as destination = dropping off
    if (apsWithDelivery.length > 0) {
        //console.log("APS with possible delivery: ", apsWithDelivery);
        let self = this;
        apsWithDelivery.forEach(function (aps) {
            let s = vgap.getShip(aps.sid);
            if (aps.shipFunction === "dis" || aps.shipFunction === "bld") {
                self.addShipCargoToBalance(s);
            }
        });
    }
};
Colony.prototype.setShipResourceDeliveries = function() {
    let withDelivery = autopilot.myShips.findByTargetPlanet(this.planet.id); // potential drop off?
    if (withDelivery && withDelivery.length > 0) {
        //console.log("APS with possible delivery: ", apsWithDelivery);
        let self = this;
        withDelivery.forEach(function (s) {
            self.addShipCargoToBalance(s);
        });
    }
};
Colony.prototype.setFortMineralExcess = function()
{
    // keep 50 of each building mineral
    this.balance.duranium -= 50;
    this.balance.tritanium -= 50;
    this.balance.molybdenum -= 50;
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
    /*let apsIdleFuel = autopilot.getIdleAPSfuelDeficiency(p);
    if (apsIdleFuel)
    {
        target += apsIdleFuel;
    }*/
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
Colony.prototype.setMineralProduction = function()
{
    this.mineralProduction = this.getMineralProduction();
};
Colony.prototype.getMineralProduction = function(mines) {
    if (typeof mines === "undefined") mines = this.planet.mines;
    let m = autopilot.minerals;
    let production = {
        neutronium: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    for(let i = 0; i < m.length; i++) {
        production[m[i]] = this.getMineralOutput(m[i], mines);
    }
    return production;
};
Colony.prototype.getMinesForOptimalProduction = function(mineral, output) {
    let mines = this.planet.mines;
    let sM = this.getMaxMines();
    let production = this.getMineralProduction(mines);
    while(mines + 10 <= sM.max && production[mineral] < output) {
        mines += 10;
        production = this.getMineralProduction(mines);
    }
    return mines;
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
Colony.prototype.getStructures = function() {
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
            finalTarget: this.getFinalTargetFactories(),
            def: fDef,
            max: mF.max,
            maxNow: mF.maxNow,
            production: p.factories
        },
        mines: {
            now: p.mines,
            target: p.targetmines,
            finalTarget: this.getFinalTargetMines(),
            def: mDef,
            max: mM.max,
            maxNow: mM.maxNow,
            production: mP
        },
        defense: {
            now: p.defense,
            target: p.targetdefense,
            finalTarget: this.getFinalTargetDefense(),
            def: dDef,
            max: mD.max,
            maxNow: mD.maxNow,
            production: false
        }
    };
};
//  PLANETARY
Colony.prototype.getMaxMines = function() {
    let p = this.planet;
    let maxMines = 0;
    if (this.maxColPop >= 200) {
        maxMines = 200 + Math.sqrt(this.maxColPop - 200);
    } else {
        maxMines = this.maxColPop;
    }
    let mM = Math.floor(parseInt(maxMines));
    if (p.clans >= 200) {
        maxMines = 200 + Math.sqrt(p.clans - 200);
    } else {
        maxMines = p.clans;
    }
    return { max: mM, maxNow: Math.floor(maxMines) };
};
Colony.prototype.getMaxFactories = function() {
    let p = this.planet;
    let maxFact = 0;
    if (this.maxColPop >= 100) {
        maxFact = 100 + Math.sqrt(this.maxColPop - 100);
    } else {
        maxFact = this.maxColPop;
    }
    let mF = Math.floor(parseInt(maxFact));
    if (p.clans >= 100) {
        maxFact = 100 + Math.sqrt(p.clans - 100);
    } else {
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
Colony.prototype.setBuildTargets = function() {
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
        let p = this.planet;
        p.targetmines = 0;
        p.targetfactories = 0;
        if (this.isDoomed() && (p.builtmines > 0 || p.builtfactories > 0 || p.builtdefense > 0))
        {
            let refundSupplies = p.builtmines + p.builtfactories + p.builtdefense;
            let refundMCs = (p.builtmines * 4) + (p.builtfactories * 3) + (p.builtdefense * 10);
            p.mines -= p.builtmines;
            p.factories -= p.builtfactories;
            p.defense -= p.builtdefense;
            p.builtmines = 0; p.builtfactories = 0; p.builtdefense = 0;
            p.supplies += refundSupplies;
            p.megacredits += refundMCs;
        }
    }
};
Colony.prototype.getStructuresThatCanBeBuilt = function(type) {
    let cost = {
        mines: 4,
        factories: 3,
        defense: 10
    };
    let p = this.planet;
    let curSupply = p.supplies;
    let curMCs = p.megacredits;
    let buildable = 0;
    while (curSupply > 0)
    {
        if (curMCs >= cost[type])
        {
            curMCs -= cost[type];
            curSupply -= 1;
            buildable++;
        } else
        {
            if (curSupply > cost[type])
            {
                curSupply -= (cost[type] + 1);
                buildable++;
            } else {
                if (curSupply > cost[type] - curMCs) buildable++;
                curSupply = 0;
            }
        }
    }
    return buildable;
};

Colony.prototype.getFinalTargetMines = function() {
    let mM = this.getMaxMines();
    let self = this;
    let finalMines = 0;
    if (this.k50Minerals.length === 0) {
        if (mM.max >= 50) {
            finalMines = 50;
        } else {
            finalMines = mM.maxNow;
        }
    } else if (this.k50Minerals.length > 0 && this.k75Minerals.length === 0) {
        finalMines = 100;
        if (mM.max < finalMines) {
            finalMines = mM.max;
        } else {
            let optimalMines = this.k50Minerals.map(function (m) {
                return { mineral: m, mines: self.getMinesForOptimalProduction(m, 100) };
            });
            optimalMines.sort(function (a, b) {
                return a.mines - b.mines;
            });
            if (this.k50Minerals.length === 1 && this.k50Minerals[0] === "tritanium") optimalMines = this.k50Minerals.map(function (m) {
                return { mineral: m, mines: self.getMinesForOptimalProduction(m, 50) };
            });
            if (finalMines < optimalMines[0]) finalMines = optimalMines[0];
            if (mM.max < finalMines) finalMines = mM.max;
        }
    } else if (this.k75Minerals.length > 0) {
        finalMines = 150;
        if (mM.max < finalMines) {
            finalMines = mM.max;
        } else {
            let optimalMines = this.k75Minerals.map(function (m) {
                return {mineral: m, mines: self.getMinesForOptimalProduction(m, 150)};
            });
            optimalMines.sort(function (a, b) {
                return a.mines - b.mines;
            });
            if (this.k75Minerals.length === 1 && this.k75Minerals[0] === "tritanium") optimalMines = this.k75Minerals.map(function (m) {
                return { mineral: m, mines: self.getMinesForOptimalProduction(m, 75) };
            });
            if (finalMines < optimalMines[0]) finalMines = optimalMines[0];
            if (mM.max < finalMines) finalMines = mM.max;
        }
    }
    return finalMines;
};
Colony.prototype.adjustTargetMines = function() {
    let p = this.planet;
    let sF = this.structures.factories;
    let sM = this.structures.mines;
    let self = this;
    if (sM.def === 0) {
        p.targetmines = 0; // reset
        if (p.factories >= 50 || p.factories >= sF.maxNow) {
            if (sM.finalTarget > p.mines) {
                let buildableMines = this.getStructuresThatCanBeBuilt("mines");
                if (buildableMines === 0) {
                    if (p.mines + 10 <= sM.finalTarget) p.targetmines = p.mines + 10;
                } else if (buildableMines) {
                    if (p.mines + buildableMines <= sM.finalTarget) {
                        p.targetmines = p.mines + buildableMines;
                    } else {
                        p.targetmines = sM.finalTarget;
                    }
                }
            }
        }
        this.updateStructures();
    } else if (sM.target > sM.maxNow) {
        p.targetmines = 0;
        this.updateStructures();
    }
};
Colony.prototype.buildMines = function(n) {
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 4
    };
    this.updateStructures();
    let sM = this.structures.mines;
    for (let i = 0; i < n; i++) {
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
    this.updateStructures();
};

Colony.prototype.getFinalTargetFactories = function() {
    return 100;
};
Colony.prototype.adjustTargetFactories = function() {
    let p = this.planet;
    let f = p.factories;
    let sF = this.structures.factories;
    if (sF.def === 0) {
        p.targetfactories = 0; // reset
        let buildableFactories = this.getStructuresThatCanBeBuilt("factories");
        if (f < 50 && sF.maxNow < 50 && sF.maxNow > f) {
            p.targetfactories = sF.maxNow;
        } else if (f < 50 && sF.maxNow >= 50) {
            p.targetfactories = 50;
        } else if (f >= 50 && sF.maxNow >= 50) {
            // build 25 more factories each round up to 200 final
            if (sF.maxNow >= f && f < 100 && p.mines >= 50) {
                if (f + 25 < 100 || f + buildableFactories < 100) {
                    p.targetfactories = f + 25;
                    if (buildableFactories > 25) p.targetfactories = f + buildableFactories;
                } else {
                    p.targetfactories = 100;
                }
            } else if (sF.maxNow - 50 >= f && f < sF.maxNow - 50 && p.mines >= 50 && (this.hasStarbase || this.isFort)) {
                if (f + 25 < sF.maxNow || f + buildableFactories < sF.maxNow) {
                    p.targetfactories = f + 25;
                    if (buildableFactories > 25) p.targetfactories = f + buildableFactories;
                } else {
                    p.targetfactories = sF.maxNow;
                }
            }
        }
        this.updateStructures();
    } else if (sF.target > sF.maxNow) {
        p.targetfactories = 0;
        this.updateStructures();
    }
};
Colony.prototype.buildFactories = function(n) {
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 3
    };
    this.updateStructures();
    let sF = this.structures.factories;
    for (let i = 0; i < n; i++) {
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
    this.updateStructures();
};

Colony.prototype.getFinalTargetDefense = function() {
    let mD = this.getMaxDefense();
    let finalDefense = 0;
    if (this.isFort)
    {
        finalDefense = mD.max;
    } else
    {
        finalDefense = 31;
    }
    return finalDefense;
};
Colony.prototype.adjustTargetDefense = function() {
    let p = this.planet;
    let dD = this.defaultDefense;
    let sD = this.structures.defense;
    let sF = this.structures.factories;
    let sM = this.structures.mines;
    p.targetdefense = 0; // reset
    if (sF.def === 0 && (p.factories >= 50 || p.factories >= sF.maxNow) && sM.def === 0 && (p.mines >= 50 || p.mines >= sM.maxNow) && p.builtdefense === 0)
    {
        if (this.isFort)
        {
            if (p.defense < sD.maxNow)
            {
                p.targetdefense = sD.maxNow;
            } else
            {
                if (p.defense <= sD.max - 10) p.targetdefense += 10;
            }
        } else
        {
            if (p.defense < dD)
            {
                p.targetdefense = dD;
            } else
            {
                if (p.defense < sD.maxNow && p.defense < 25) {
                    p.targetdefense = 25;
                } else if (p.defense < sD.maxNow && p.defense < 31) {
                    p.targetdefense = 31;
                } else if (p.defense < sD.maxNow) {
                    if (!this.safetyStatus) this.getSafetyStatus();
                    if (this.safetyStatus.enemyPlanets.length > 0 || this.safetyStatus.enemyShips.length > 0) {
                        p.targetdefense = sD.maxNow;
                    }
                }
            }
        }
        this.updateStructures();
    } else {
        if (sD.target > sD.maxNow) {
            p.targetdefense = 0;
            this.updateStructures();
        }
    }
};
Colony.prototype.buildDefense = function(n) {
    let p = this.planet;
    let cost = {
        supplies: 1,
        megacredits: 10
    };
    this.updateStructures();
    let sD = this.structures.defense;
    for (let i = 0; i < n; i++) {
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
    this.updateStructures();
};

Colony.prototype.buildStructures = function() {
    if (this.isOwnPlanet && !this.isDoomed()) {
        // Factories
        let fS = this.structures.factories;
        let mS = this.structures.mines;
        let buildFactories = fS.def;
        if (fS.def > 0 && mS.def > 0) {
            let buildableFactories = this.getStructuresThatCanBeBuilt("factories");
            if (buildableFactories <= fS.def && buildableFactories > 10) buildFactories = Math.ceil(fS.def / 2);
        }
        this.buildFactories(buildFactories);
        // Mines
        this.adjustTargetMines();
        let buildMines = mS.def;
        if (mS.def > 0) this.buildMines(buildMines);
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
Colony.prototype.getSbDefenseThatCanBeBuilt = function(type)
{
    let curCost = this.sbDefCosts[type];
    let curMineralComponents = Object.keys(curCost);
    curMineralComponents = curMineralComponents.filter(function (c) {
        return c !== "megacredits";
    });
    let p = this.planet;
    let curMCs = p.megacredits;
    let curSupply = p.supplies;
    let curMinerals = {
        duranium: p.duranium,
        tritanium: p.tritanium,
        molybdenum: p.molybdenum
    };
    let buildable = 0;

    while (curMCs + curSupply > 0) {
        if (curMCs >= curCost.megacredits) {
            let ready = true;
            curMineralComponents.forEach(function (m) {
                if (curMinerals[m] < curCost[m]) ready = false;
            });
            if (ready) {
                curMCs -= curCost.megacredits;
                curMineralComponents.forEach(function (m) {
                    curMinerals[m] -= curCost[m];
                });
                buildable++;
            } else {
                break; // not enough minerals!
            }
        } else {
            if (curMCs + curSupply >= curCost.megacredits) {
                let ready = true;
                curMineralComponents.forEach(function (m) {
                    if (curMinerals[m] < curCost[m]) ready = false;
                });
                if (ready) {
                    curSupply -= (curCost.megacredits - curMCs);
                    curMCs = 0;
                    curMineralComponents.forEach(function (m) {
                        curMinerals[m] -= curCost[m];
                    });
                    buildable++;
                } else {
                    break; // not enough minerals!
                }
            } else {
                break; // not enough megacredits (+supplies)!
            }
        }
    }
    return buildable;
};
Colony.prototype.setStarbaseProduction = function() {
    //console.log("Colony.setStarbaseProduction:");
    let sb = this.hasStarbase;
    let sbD = {
        megacredits: 0,
        duranium: 0,
        tritanium: 0,
        molybdenum: 0
    };
    // depending on available hull technology, retain minerals to be able to build all hightech hulls
    let maxTechHulls = autopilot.myHulls.filter(function (h) {
        if (sb.hulltechlevel < 10) {
            return (h.techlevel === sb.hulltechlevel || h.techlevel === sb.hulltechlevel + 1);
        } else {
            return h.techlevel === sb.hulltechlevel;
        }
    });
    //console.log("...maxTechHulls", maxTechHulls);
    maxTechHulls.forEach(function (h) {
        sbD.megacredits += h.cost;
        sbD.duranium += h.duranium;
        sbD.tritanium += h.tritanium;
        sbD.molybdenum += h.molybdenum;
        if (h.engines > 0) {
            //console.log(vgap.engines, sb.enginetechlevel);
            let curE = vgap.engines.find(function (e) {
                return e.techlevel === sb.enginetechlevel;
            });
            if (curE) {
                sbD.megacredits += (curE.cost * h.engines);
                sbD.duranium += (curE.duranium * h.engines);
                sbD.tritanium += (curE.tritanium * h.engines);
                sbD.molybdenum += (curE.molybdenum * h.engines);
            } else {
                console.error("engine not found!", sb.enginetechlevel);
            }
        }
        if (h.beams > 0) {
            let curB = vgap.beams[sb.beamtechlevel-1];
            sbD.megacredits += (curB.cost * h.beams);
            sbD.duranium += (curB.duranium * h.beams);
            sbD.tritanium += (curB.tritanium * h.beams);
            sbD.molybdenum += (curB.molybdenum * h.beams);
        }
        if (h.launchers > 0) {
            let curL = vgap.torpedos[sb.torptechlevel-1];
            sbD.megacredits += (curL.launchercost * h.launchers);
            sbD.duranium += (curL.duranium * h.launchers);
            sbD.tritanium += (curL.tritanium * h.launchers);
            sbD.molybdenum += (curL.molybdenum * h.launchers);
        }
    });
    //Object.keys(sbD).forEach(function (r) { sbD[r] *= 2; });
    //console.log("...sbD", sbD);
    let minPro = this.mineralProduction;
    if (sbD.duranium > minPro.duranium) {
        this.balance.duranium -= (sbD.duranium - minPro.duranium);
    }
    if (sbD.tritanium > minPro.tritanium) {
        this.balance.tritanium -= (sbD.tritanium - minPro.tritanium);
    }
    if (sbD.molybdenum > minPro.molybdenum) {
        this.balance.molybdenum -= (sbD.molybdenum - minPro.molybdenum);
    }
    if (sbD.megacredits > this.getRevenue()) {
        this.balance.megacredits -= (sbD.megacredits - this.getRevenue());
    }
};
Colony.prototype.getStarbaseTechMcDeficiency = function(tecs) {
    //console.log("Colony.getStarbaseTechMcDeficiency:", tecs);
    let sb = this.hasStarbase;
    let mcDeficiency = 0;
    if (tecs.length > 0) {
        tecs = tecs.filter(function (t) {
            return t.demand > sb[t.name+"techlevel"];
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
Colony.prototype.setStarbaseDeficiency = function() {
    //console.log("Colony.setStarbaseDeficiency:");
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
    if (this.isFort) {
        minSbFighter = 60; // maximize fighter defense
        minSbDefense = 200; // maximize defense posts
        tecLvls = [
            {
                name: "beam",
                demand: 10
            }
        ];
        // torpedo building backup (150 with max available torp tec)
        sbD.megacredits += 150 * torpCost[sb.torptechlevel];
        sbD.duranium += 150;
        sbD.tritanium += 150;
        sbD.molybdenum += 150;
    } else {
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
    if (tecLvls.length > 0) {
        let tecMcDef = this.getStarbaseTechMcDeficiency(tecLvls);
        if (tecMcDef) {
            //console.log("...technological deficiency detected:", tecMcDef);
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
    if (sbD.duranium > minPro.duranium) {
        this.balance.duranium -= (sbD.duranium - minPro.duranium);
    }
    if (sbD.tritanium > minPro.tritanium) {
        this.balance.tritanium -= (sbD.tritanium - minPro.tritanium);
    }
    if (sbD.molybdenum > minPro.molybdenum) {
        this.balance.molybdenum -= (sbD.molybdenum - minPro.molybdenum);
    }
    if (sbD.megacredits > this.getRevenue()) {
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
    //console.log("Colony.getTechDeficiency: %d -> %d = %d", curTech, wantTech, def);
    return def;
};
Colony.prototype.buildSbDefense = function() {
    let sb = this.hasStarbase;
    let dpDeficiency = false;
    if (sb) {
        if (sb.starbasetype === 0) { // standard starbase
            dpDeficiency = 100 - sb.defense;
        } else {
            // toDo: other sb types!
        }
        this.buildSbDefensePosts();
        if (!dpDeficiency) this.buildSbFighters();
    }
};
Colony.prototype.buildSbDefensePosts = function() {
    console.log("Colony.buildSbDefensePosts:");
    let sb = this.hasStarbase;
    if (sb && sb.builtdefense === 0) {
        let p = this.planet;
        let canBuild = this.getSbDefenseThatCanBeBuilt("defense");
        let wantBuild = 0;
        let doBuild = 0;
        //
        if (this.isFort) {
            if (sb.defense < parseInt(autopilot.settings.minSbDefense)) {
                wantBuild = parseInt(autopilot.settings.minSbDefense) - sb.defense;
            } else {
                if (sb.starbasetype === 0) { // standard starbase
                    wantBuild = 200 - sb.defense;
                }
            }
            if (canBuild >= wantBuild) {
                doBuild = wantBuild;
            } else {
                doBuild = canBuild;
            }
        } else {
            if (sb.defense < parseInt(autopilot.settings.minSbDefense)) {
                wantBuild = parseInt(autopilot.settings.minSbDefense) - sb.defense;
            } else {
                if (sb.starbasetype === 0) { // standard starbase
                    wantBuild = 100 - sb.defense;
                }
            }
            if (canBuild >= wantBuild) {
                doBuild = wantBuild;
            } else {
                doBuild = canBuild;
            }
        }
        if (doBuild > 0) {
            let costs = this.sbDefCosts.defense;
            let costComponents = Object.keys(costs);
            let finalCosts = [];
            costComponents.forEach(function (c) {
                if (c === "megacredits" && (costs[c] * doBuild) > p.megacredits) {
                    let suppliesNeeded = (costs[c] * doBuild) - p.megacredits;
                    finalCosts.push({ item: "supplies", value: suppliesNeeded });
                    finalCosts.push({ item: c, value: p.megacredits });
                } else {
                    finalCosts.push({ item: c, value: costs[c] * doBuild });
                }
            });
            if (finalCosts.length > 0) {
                console.log("...finalCost for building %d defense posts:", doBuild, finalCosts);
                finalCosts.forEach(function (c) {
                    if (c.item === "supplies") {
                        p[c.item] -= c.value;
                        p.suppliessold += c.value;
                    } else {
                        p[c.item] -= c.value;
                    }
                });
                sb.builtdefense = doBuild;
                sb.defense += doBuild;
            }
        }
    }
};
Colony.prototype.buildSbFighters = function()
{
    console.log("Colony.buildSbFighters:");
    let sb = this.hasStarbase;
    if (sb && sb.builtfighters === 0)
    {
        let p = this.planet;
        let canBuild = this.getSbDefenseThatCanBeBuilt("fighters");
        let wantBuild = 0;
        let doBuild = 0;
        //
        if (this.isFort)
        {
            if (sb.fighters < parseInt(autopilot.settings.minSbFighters))
            {
                wantBuild = parseInt(autopilot.settings.minSbFighters) - sb.fighters;
            } else
            {
                if (sb.starbasetype === 0) { // standard starbase
                    wantBuild = 60 - sb.fighters;
                }
            }
            if (canBuild >= wantBuild)
            {
                doBuild = wantBuild;
            } else {
                doBuild = canBuild;
            }
        } else {
            if (sb.fighters < parseInt(autopilot.settings.minSbFighters))
            {
                wantBuild = parseInt(autopilot.settings.minSbFighters) - sb.fighters;
            } else
            {
                if (sb.starbasetype === 0) { // standard starbase
                    wantBuild = 30 - sb.fighters;
                }
            }
            if (canBuild >= wantBuild)
            {
                doBuild = wantBuild;
            } else {
                doBuild = canBuild;
            }
        }
        if (doBuild > 0)
        {
            let costs = this.sbDefCosts.fighters;
            let costComponents = Object.keys(costs);
            let finalCosts = [];
            costComponents.forEach(function (c) {
                if (c === "megacredits" && (costs[c] * doBuild) > p.megacredits)
                {
                    let suppliesNeeded = (costs[c] * doBuild) - p.megacredits;
                    finalCosts.push({ item: "supplies", value: suppliesNeeded });
                    finalCosts.push({ item: c, value: p.megacredits });
                } else {
                    finalCosts.push({ item: c, value: costs[c] * doBuild });
                }
            });
            if (finalCosts.length > 0)
            {
                console.log("...finalCost for building %d fighters:", doBuild, finalCosts);
                finalCosts.forEach(function (c) {
                    if (c.item === "supplies")
                    {
                        p[c.item] -= c.value;
                        p.suppliessold += c.value;
                    } else {
                        p[c.item] -= c.value;
                    }
                });
                sb.builtfighters = doBuild;
                sb.fighters += doBuild;
            }
        }
    }
};
/*
    POPULATIONS, TAXES and MEGACREDITS
 */
Colony.prototype.getRevenue = function(taxation, potential, additionalHizzzers) {
    let revenue = 0;
    if (typeof taxation === "undefined") taxation = this.taxation;
    if (typeof potential === "undefined") potential = false;
    if (taxation && (taxation === "default" || taxation === "growth")) {
        let hizzerBonus = 0;
        if (typeof additionalHizzzers !== "undefined") hizzerBonus = additionalHizzzers * 5;
        if (taxation === "default") {
            revenue += this.getIncomeFromColonists(this.getMaxHappyColonistTaxRate(hizzerBonus));
            if (this.planet.nativeclans > 0) revenue += this.getIncomeFromNatives(this.getMaxHappyNativeTaxRate(hizzerBonus), potential);
        } else if (taxation === "growth") {
            revenue += this.getIncomeFromColonists(this.getMinHappyColonistTaxRate(hizzerBonus));
            if (this.planet.nativeclans > 0) revenue += this.getIncomeFromNatives(this.getMinHappyNativeTaxRate(hizzerBonus), potential);
        }
        if (revenue > this.maxIncome) return this.maxIncome;
    }
    return revenue;
};
Colony.prototype.setTargetMegacredits = function() {
    let s = this.getStructures();
    let target = parseInt(autopilot.settings.defMcsRetention); // default minimum amount at planet
    target += (s.factories.def * 3);
    target += (s.mines.def * 4);
    target += (s.defense.def * 10);
    if (this.hasStarbase) target += parseInt(autopilot.settings.sbMcsRetention); // default minimum amount at starbases
    this.target.megacredits = target;
};
Colony.prototype.getMcDeficiency = function() {
    this.setTargetMegacredits();
    let p = this.planet;
    let deficiency = p.megacredits + this.getRevenue() - this.target.megacredits;
    //console.log("getMCDeficiency: p.megacredits = ",  p.megacredits);
    if (deficiency > 0) deficiency -= this.getRevenue();
    if (deficiency < 0) {
        if (this.balance.supplies > 0) deficiency += this.balance.supplies;
    }
    //console.log("getMCDeficiency: ",  deficiency);
    return deficiency;
};
Colony.prototype.setTaxes = function()
{
    //console.log("APP: Setting taxes...")
    let p = this.planet;
    if (this.isSqueezingPopulations()) { this.taxation = "squeeze"; this.squeezeTaxes(); } // colonists and natives
    if (this.isTaxingByDefault()) { this.taxation = "default"; this.setDefaultTaxrate(); }
    if (this.isTaxing4Growth()) { this.taxation = "growth"; this.setGrowthTaxrate(); }
    // riot "safeguard"
    if (p.colonisthappypoints < 40 && p.colonisttaxrate > 0) p.colonisttaxrate = 0;
    if (p.nativehappypoints < 40 && p.nativetaxrate > 0) p.nativetaxrate = 0;
    // don't care - doomed
    if (this.isDoomed() && p.colonisttaxrate < 100) p.colonisttaxrate = 100;
    if (this.isDoomed() && p.nativeclans > 0 && p.nativeracename !== "Amorphous" && p.nativetaxrate < 100) p.nativetaxrate = 100;
};
//  NATIVES
Colony.prototype.getNativeGrowth = function(taxrate) {
    let p = this.planet;
    if (typeof taxrate === "undefined") taxrate = p.nativetaxrate;
    let growth = 0;
    let growthModifier = 1;
    if (p.nativeclans < 1) return 0;
    if (p.nativehappypoints < 70) return 0;
    if (p.nativeclans >= this.maxNatPop) return 0;
    if (p.nativeclans > 66000) growthModifier = 0.5;

    if (p.nativeracename === "Siliconoids") {
        growth = growthModifier * (p.temp / 100) * (p.nativeclans / 20) * (5 / (taxrate + 5));
    } else {
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
Colony.prototype.getOptNatTaxClans = function(taxrate) {
    // return the number of clans needed to receive all native taxes
    if (typeof taxrate === "undefined") taxrate = this.planet.nativetaxrate;
    let optClans = Math.ceil(this.getIncomeFromNatives(taxrate));
    if (this.planet.nativeracename === "Insectoid") optClans = Math.floor(optClans / 2);
    if (optClans > this.maxColPop) optClans = this.maxColPop;
    return optClans;
};
Colony.prototype.getNativeHappinessChange = function(taxrate, bonus) // returns -/0/+ amount of happynesspoints = change in happiness using taxrate
{
    let p = this.planet;
    let nativeRaceBonus = p.nativeracename === "Avian" ? 10 : 0;
    let nebulaBonus = 0; // toDo: get nebulaBonus // The Nebula Bonus is 5 if the planet is in a nebula and has less than 50 light-years visibility.
    let addHappyness = 0;
    if (typeof bonus !== "undefined") addHappyness = bonus;
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
    let happychange = (Math.round( (1000 - Math.sqrt(p.nativeclans) - 85 * taxrate - Math.round( (p.mines + p.factories) / 2 ) - 50 * (10 - p.nativegovernment)) ) / 100) + nativeRaceBonus + nebulaBonus;
    let maxAddHappyness = 100 - (p.nativehappypoints + happychange) ;
    if (addHappyness > maxAddHappyness) addHappyness = maxAddHappyness;
    return happychange + addHappyness;

};
Colony.prototype.getMaxHappyNativeTaxRate = function(bonus) // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (let i=50; i>0; i--) {
        let happinessChange = this.getNativeHappinessChange(i, bonus);
        if (happinessChange > -1) {
            return i;
        }
    }
    return 0;
};
Colony.prototype.getMinHappyNativeTaxRate = function(bonus) // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (let i = 1; i < 50; i++)
    {
        let happinessChange = this.getNativeHappinessChange(i, bonus);
        if (happinessChange < 1)
        {
            return i;
        }
    }
    return 0;
};
Colony.prototype.getMaxIncomeFromNatives = function()
{
    let p = this.planet;
    if (p.nativeclans > 0) {
        let taxrate = 100;
        let income = this.getIncomeFromNatives(taxrate);
        if (income > 5000) return 5000;
        return Math.ceil(income);
    } else {
        return 0;
    }
};
Colony.prototype.getIncomeFromNatives = function(taxRate, potential) {
    let p = this.planet;
    if (typeof taxRate === "undefined") taxRate = p.nativetaxrate;
    if (typeof potential === "undefined") potential = true;
    if (p.nativeclans > 0) {
        let race = vgap.player.raceid;
        if (race === 6) if (taxRate > 20) taxRate = 20;
        let income = Math.round(p.nativeclans * (taxRate / 100) * (p.nativegovernment / 5) / 10);
        if (p.nativeracename === "Insectoid") income *= 2;
        if (race === 1) income *= 2;
        if (race === 12) income = p.nativeclans;
        if (income > this.maxIncome) income = this.maxIncome;
        if (race !== 12 && p.nativeracename === "Amorphous") income = 0;
        if (race === 12 && p.nativeracename === "Siliconoid") income = 0;
        if (potential) return income;
        if (!potential && p.clans < income) return p.clans;
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
Colony.prototype.getOptLabor = function(final) {
    if (typeof final === "undefined") final = false;
    let s = this.structures;
    let p = this.planet;
    let mines = p.mines;
    if (p.targetmines > p.mines) mines = p.targetmines;
    if (final) mines = s.mines.finalTarget;
    let factories = p.factories;
    if (p.targetfactories > p.factories) factories = p.targetfactories;
    if (final) factories = s.factories.finalTarget;
    let defense = 15; // avoid detection
    if (p.targetdefense > 15) defense = p.targetdefense;
    //
    let pStructures = [
        { n: mines, thresh: 200 },
        { n: factories, thresh: 100 },
        { n: defense, thresh: 50 }
    ];
    //
    pStructures.forEach(function (item, index) {
        pStructures[index].optLabor = item.n;
        if (item.n > item.thresh) {
            pStructures[index].optLabor = item.thresh + Math.pow((item.n - item.thresh), 2);
        }
    });
    pStructures.sort(function(a, b) {
        return b.optLabor - a.optLabor;
    });
    return pStructures[0].optLabor;
};
Colony.prototype.getOptBovSupClans = function()
{
    if (this.planet.nativeracename === "Bovinoid") {
        return Math.round(this.planet.nativeclans / 100);
    }
    return 0;
};
Colony.prototype.getColonistHappinessChange = function(taxrate, bonus) // returns -/0/+ amount of happynesspoints = change in happiness using taxrate
{
    //console.log("Colony.getColonistHappinessChange:");
    let p = this.planet;
    let raceMod = 1;
    if (vgap.player.raceid === 1) raceMod = 2; // feds //toDo ??
    let baseTemp = 50;
    let addHappyness = 0;
    if (typeof bonus !== "undefined") addHappyness = bonus;
    if (vgap.player.raceid === 7) baseTemp = 100; // crystals
    if (vgap.player.raceid === 2) { // lizzards
        let ships = vgap.shipsAt(p.x, p.y);
        if (ships.length > 0) {
            ships.forEach(function (s) {
                if (s.mission === 8) addHappyness += 5; // Hisssss
            });
            //if (addHappyness) console.log("Ships are hissing planet %s: + %s Happiness", p.id, addHappyness);
        }
    }
    let happychange = ( Math.round( (1000 - Math.sqrt(p.clans) - 80 * taxrate - Math.abs(baseTemp - p.temp) * 3 - (p.mines + p.factories) / 3 ) / 100) );
    let maxAddHappyness = 100 - (p.colonnisthappypoints + happychange) ;
    if (addHappyness > maxAddHappyness) addHappyness = maxAddHappyness;
    return happychange + addHappyness;

};
Colony.prototype.getMaxHappyColonistTaxRate = function(bonus) // returns taxrate at which no negative change in happynesspoints occurs (negative approach)
{
    for (let i = 50; i > 0; i--)
    {
        let happinessChange = this.getColonistHappinessChange(i, bonus);
        if (happinessChange > -1) {
            return i;
        }
    }
    return 0;
};
Colony.prototype.getMinHappyColonistTaxRate = function(bonus) // returns taxrate at which no negative change in happynesspoints occurs (positive approach)
{
    for (let i = 1; i < 50; i++)
    {
        let happinessChange = this.getColonistHappinessChange(i, bonus);
        if (happinessChange < 1)
        {
            return i;
        }
    }
    return 0;
};
Colony.prototype.getIncomeFromColonists = function(taxRate)
{
    if (typeof taxRate === "undefined") taxRate = this.planet.colonisttaxrate;
    if (taxRate === 0) return 0;
    return Math.round(this.planet.clans * taxRate * 0.001);
};
Colony.prototype.setTargetClans = function()
{
    let p = this.planet;
    let growthPop = this.getMinGrowthColPop();
    let defaultClans = 100;
    if (growthPop) defaultClans = growthPop;
    if (this.maxColPop < defaultClans && this.maxColPop > 0) {
        this.target.clans = this.maxColPop;
        if (p.nativeracename === "Bovinoid") this.target.clans = this.optBovSupClans; // exception for bovinoids!
    } else {
        let targets = [ defaultClans, this.optLabor ];
        if (this.minColPop) targets.push(this.minColPop);
        if (p.nativeracename === "Bovinoid") targets.push(this.optBovSupClans);
        if (this.isSqueezingPopulations() && p.nativeclans > 0) targets.push(this.squeezeColPop); // squeezing taxation: colonists necessary to collect maximum revenue
        if ((this.isTaxingByDefault() || !this.isOwnPlanet) && p.nativeclans > 0) targets.push(this.optNatTaxClans); // squeezing taxation: colonists necessary to collect maximum revenue
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
    return deficiency;
};
/*
    MISSIONS
*/
Colony.prototype.isDoomed = function()
{
    if (this.settings)
    {
        return (this.settings.taxation === "des");
    } else
    {
        return false;
    }
};
Colony.prototype.isBuildingStarbase = function() {
    if (this.settings) {
        if (this.hasStarbase && this.settings.pMission === "bba") {
            this.settings.pMission = false;
            autopilot.planeteers.update(this.planet.id, this.settings);
            autopilot.planeteers.save();
        }
        return (this.settings.pMission === "bba" || this.planet.buildingstarbase);
    } else {
        return this.planet.buildingstarbase;
    }
};
Colony.prototype.getSellingSupply = function()
{
    if (this.settings)
    {
        return (this.settings.production === "ssu");
    } else
    {
        return false;
    }
};
Colony.prototype.getBuildingStructures = function()
{
    if (this.settings)
    {
        return (this.settings.production === "bst");
    } else
    {
        return false;
    }
};
Colony.prototype.setBaseBuildingDeficiency = function() {
    this.balance.megacredits -= 900;
    this.balance.duranium -= 120;
    this.balance.tritanium -= 402;
    this.balance.molybdenum -= 340;
};
Colony.prototype.isSqueezingPopulations = function()
{
    if (this.settings)
    {
        return (this.settings.taxation === "stx");
    } else
    {
        return false;
    }
};
Colony.prototype.isTaxing4Growth = function()
{
    if (this.settings)
    {
        return (this.settings.taxation === "grw");
    } else
    {
        return false;
    }
};
Colony.prototype.isTaxingByDefault = function()
{
    if (this.settings) {
        return (this.settings.taxation === "dft");
    } else {
        return false;
    }
};
Colony.prototype.isFortifying = function()
{
    if (this.settings)
    {
        return (this.settings.pMission === "bfo");
    } else
    {
        return false;
    }
};
Colony.prototype.getFortStatus = function()
{
    let sbDefense = {
        0: {
            defense: 200,
            fighters: 60
        }
    };
    let sb = this.hasStarbase;
    if (sb && this.isFort)
    {
        if (typeof sbDefense[sb.starbasetype] !== "undefined")
        {
            return (sb.defense >= sbDefense[sb.starbasetype].defense && sb.fighters >= sbDefense[sb.starbasetype].fighters);
        }
    }
    return false;
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
            //curHappyChange = this.getNativeHappinessChange(p.nativetaxrate);
            curIncome = this.getIncomeFromNatives(p.nativetaxrate);
            happyExcess = p.nativehappypoints - 40;
            if (happyExcess > 0 && (curHappyChange *-1) < happyExcess && p.nativetaxrate < 100)
            {
                // there is room to squeeze... set taxrate so happyExcess is reduced to 0
                startTaxation = p.nativetaxrate;
                let modifier = 1;
                if (p.nativeracename === "Insectoid") modifier = 2;
                while ((curHappyChange + happyExcess) > 0 && curIncome < 5000 && curIncome < (p.clans * modifier))
                {
                    startTaxation++;
                    if (startTaxation > 99) break;
                    curHappyChange = this.getNativeHappinessChange(startTaxation);
                    curIncome = this.getIncomeFromNatives(startTaxation);
                }
                // use current startTaxation -1 point
                let optTaxClans = this.getOptNatTaxClans((startTaxation - 1)); // how much clans we need to get all taxes
                if (p.clans * (1/modifier) > (optTaxClans * 0.95) || curIncome > 500) // only act when more than 95 % of the required colonists are present
                {
                    if (vgap.player.raceid === 6 && (startTaxation - 1) > 20) // borg tax limitation
                    {
                        p.nativetaxrate = 20;
                    } else
                    {
                        p.nativetaxrate = (startTaxation - 1);
                        if (p.clans * (1/modifier) < optTaxClans) p.nativetaxrate = startTaxation;
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
    // - no taxation if there are 40 or less happypoints
    //
    let p = this.planet;
    let newTaxrate = 1; // minimum
    if (parseInt(p.nativehappypoints) <= 40) newTaxrate = 0;
    //
    if (parseInt(p.nativehappypoints) > 30) {
        let happyEquiTaxRate = Math.floor(this.getMaxHappyNativeTaxRate());
        let modIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        let modifier = 1;
        if (p.nativeracename === "Insectoid") modifier = 2;
        //
        while (modIncome > p.clans * modifier) { // get taxrate that fits the availability of colonists
            happyEquiTaxRate--;
            modIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        happyEquiTaxRate++;
        if (happyEquiTaxRate > 0 && modIncome > 99) {
            newTaxrate = happyEquiTaxRate;
        }
    }
    if (p.nativetaxrate !== newTaxrate) p.nativetaxrate = newTaxrate;
};
Colony.prototype.setDefaultColonistTaxrate = function()
{
    // default:
    // - adjust taxrate so there is no change in happiness
    // - limited by income (> 99 mcs)
    // - no taxation if there are 40 or less happypoints
    //
    let p = this.planet;
    let newTaxrate = 0;
    //
    if (parseInt(p.colonisthappypoints) > 40)
    {
        let happyEquiTaxRate = Math.floor(this.getMaxHappyColonistTaxRate());
        let curIncome = this.getIncomeFromColonists(happyEquiTaxRate);
        //
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            newTaxrate = happyEquiTaxRate;
        }
    }
    if (p.colonisttaxrate !== newTaxrate) p.colonisttaxrate = newTaxrate;
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
    if (p.nativetaxrate > 0) p.nativetaxrate = 0;
    //
    if (parseInt(p.nativehappypoints) === 100)
    {
        let happyEquiTaxRate = Math.floor(this.getMinHappyNativeTaxRate());
        let nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        let modifier = 1;
        if (p.nativeracename === "Insectoid") modifier = 2;
        //
        while (nativeTaxMcs > p.clans * modifier) // get taxrate that fits the availability of colonists
        {
            happyEquiTaxRate--;
            nativeTaxMcs = this.getIncomeFromNatives(happyEquiTaxRate);
        }
        let curIncome = this.getIncomeFromNatives(happyEquiTaxRate);
        if (happyEquiTaxRate > 0 && curIncome > 99)
        {
            if (p.nativetaxrate !== happyEquiTaxRate) p.nativetaxrate = happyEquiTaxRate;
        }
    }
};
Colony.prototype.setGrowthColonistTaxrate = function()
{
    // growth:
    // - adjust taxrate so there is no change in happiness
    // - limited by income (> 99 mcs)
    // - no taxation if there are less than 100 happypoints (= no growth)
    //
    let p = this.planet;
    //
    if (parseInt(p.colonisthappypoints) === 100)
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
        this.balance.supplies -= amount; // update balance
        p.suppliessold += amount;
        p.megacredits += amount;
        this.balance.megacredits += amount; // update balance
        p.changed = 1;
    }
    return amount;
};
/*
    APS HELPERS
 */
Colony.prototype.getDistance = function (target)
{
    return Math.ceil(autopilot.getDistance( this.planet, target ));
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
        return this.getBuilderCargo(aps.destination.id, aps.objectOfInterest, aps.ship.id);
    }
};
Colony.prototype.getNextAPSCargo = function (aps, nD)
{
    if (aps.primaryFunction === "col") {
        return this.getNextCollectorCargo(aps, nD);
    } else if (aps.primaryFunction === "dis") {
        return this.getNextDistributorCargo(aps, nD);
    } else if (aps.primaryFunction === "exp") {
        return 0;
    } else if (aps.primaryFunction === "bld") {
        return this.getNextBuilderCargo(aps, nD);
    }
};
Colony.prototype.getAPSDemand = function (aps) {
    if (aps.primaryFunction === "col") {
        return this.getCollectorDemand(aps.objectOfInterest, aps.maxCapacity);
    } else if (aps.primaryFunction === "dis") {
        return this.getDistributorDemand(aps.objectOfInterest);
    } else if (aps.primaryFunction === "exp") {
        return [];
    } else if (aps.primaryFunction === "bld") {
        return this.getBuilderDemand(aps.objectOfInterest, aps.ship.id);
    }
};
Colony.prototype.isAPSSource = function (aps) {
    this.updateBalance(false);
    if (aps.primaryFunction === "col") {
        return this.isCollectorSource(aps);
    } else if (aps.primaryFunction === "dis") {
        return this.isDistributorSource(aps);
    } else if (aps.primaryFunction === "exp") {
        return this.isExpanderSource(aps);
    } else if (aps.primaryFunction === "bld") {
        return this.isBuilderSource(aps);
    } else if (aps.primaryFunction === "hiz") {
        return this.isHizzzerSource(aps);
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
Colony.prototype.sellSupplies4APS = function(aps) {
    let retainSupply = parseInt(autopilot.settings.defSupRetention);
    let retainMcs = parseInt(autopilot.settings.defMcsRetention);
    let neededMCs = (aps.demand.findByResourceName("megacredits") + retainMcs) - this.planet.megacredits;
    if (neededMCs > 0) {
        let toBeSold = this.planet.supplies - retainSupply - aps.demand.findByResourceName("supplies"); // excess
        if (aps.demand.findByResourceName("supplies") < this.planet.supplies - retainSupply && toBeSold >= neededMCs) toBeSold = neededMCs; // there is more than enough excess of supplies
        if (toBeSold > 0) this.sellSupply(true, false, toBeSold);
    }
};
// HIZZZER
Colony.prototype.isHizzzerSource = function (aps) {
    //console.log("Is colony a hizzzer source? Revenue with %s taxation = %s", this.taxation, this.getRevenue(this.taxation));
    return (this.getRevenue() > 100);
};
// TERRAFORMER
Colony.prototype.getTerraformDeficiency = function (aps) {
    let p = this.planet;
    if (p.temp < 0) return 0; // exclude planets with unknown temperatures
    let pTemp = parseInt(p.temp);
    if (pTemp > 50 && aps.terraCooler && vgap.player.raceid !== 7) {
        return (50 - pTemp);
    } else if (pTemp < 50 && aps.terraHeater && vgap.player.raceid !== 7) {
        return (pTemp - 50);
    } else if (pTemp < 100 && vgap.player.raceid === 7 && aps.terraHeater) {
        if (p.nativeclans > 0 && p.nativeracename !== "Siliconoid") {
            return (pTemp - 80); // toDo: chosen arbitrarily
        } else {
            return (pTemp - 100);
        }
    }
    return 0;
};
// EXPANDER
Colony.prototype.getExpanderKit = function(aps)
{
    let clans = 0;
    if (aps.objectOfInterest === "slw")
    {
        // default on other missions: Clans / cargo = 75 % / 25 %
        // MDSF = 150 clans, 50 supply, 150 MC
        //
        clans = Math.floor(0.75 * aps.getCurCapacity());
    } else
    {
        // default on exploration: Clans / cargo = 50 % / 50 %
        // MDSF = 100 clans, 100 supply, 300 MC
        //
        clans = Math.floor(0.50 * aps.getCurCapacity());
    }
    let sups = aps.getCurCapacity() - clans;
    let mcs = 3 * (aps.getCurCapacity() - clans);
    return {
        cla: clans,
        sup: sups,
        mcs: mcs
    };
};
Colony.prototype.isExpanderSource = function (aps) {
    if (!this.isOwnPlanet) return false;
    let eKit = this.getExpanderKit(aps);
    let supplies = this.planet.supplies - parseInt(autopilot.settings.defSupRetention); // overwrite balance
    let clans = this.balance.clans;
    let minColPop = [this.minColPop, this.optNatTaxClans, this.optBovSupClans];
    minColPop.sort(function(a, b) { return b - a });
    if (this.planet.clans > minColPop[0] && this.planet.clans - clans < minColPop[0]) clans = this.planet.clans - minColPop[0];
    return (supplies >= eKit.sup && clans >= eKit.cla);
};
// COLLECTOR
Colony.prototype.isMineralCollector = function(aps) {
    return (aps.objectOfInterest === "dur" || aps.objectOfInterest === "tri" || aps.objectOfInterest === "mol");
};
Colony.prototype.isCollectorSource = function (aps) {
    let obj = this.abrMoveables[aps.objectOfInterest];
    this.updateBalance(false);
    let excess = this.balance[obj];
    if (obj === "megacredits") excess = this.balance[obj] + this.balance.supplies;
    return (excess > 0 && ((!this.hasStarbase && !this.isBuildingBase) || this.isFort || !this.isMineralCollector(aps)))
};
Colony.prototype.getCollectorDemand = function (ooi, maxCapacity) {
    return new autopilot.demandIndex([ { item: this.abrMoveables[ooi], value: maxCapacity} ]);
};
Colony.prototype.getCollectorCargo = function (ooi) {
    let obj = this.abrMoveables[ooi];
    this.updateBalance(false);
    if (this.balance[obj] > 0) return this.balance[obj];
    return 0;
};
Colony.prototype.getNextCollectorCargo = function (aps, nD) {
    let ooi = this.abrMoveables[aps.objectOfInterest];
    if (this.balance[ooi] + aps.ship[ooi] > 0) return this.balance[ooi] + aps.ship[ooi];
    return 0;
};
// BUILDER
Colony.prototype.getBuilderCargo = function (dId, ooi, sid) {
    let b = this.balance;
    let dC = 0;
    //
    let cSite = autopilot.getColony(dId, true);
    let demand = cSite.getBuilderDemand(ooi, sid);
    //
    if (ooi === "bab" || ooi === "shb") {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item];
        });
    } else if (ooi === "stb") {
        demand.forEach(function (d) {
            if (d.item !== "megacredits") dC += b[d.item];
        });
    }
    if (dC > 0) return dC;
    return 0;
};
Colony.prototype.getNextBuilderCargo = function (aps, nD) {
    if (typeof nD === "undefined") nD = aps.destination;
    let b = this.balance;
    let dC = 0;
    let cSite = autopilot.getColony(nD.id);
    let demand = cSite.getBuilderDemand(aps.objectOfInterest, aps.ship.id);
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
Colony.prototype.getBuilderDemand = function (ooi, sid) {
    let demand = [];
    let b = this.balance;
    console.log("Get builder demand of colony:", this.pid, b);
    if (ooi === "bab") {
        if (this.hasStarbase && this.isFort && this.isFortified) {
            // collect minerals from surrounding planets
            if (!this.mineralsInRange) this.setMineralsInRange();
            let inRange = [
                {
                    item: "duranium",
                    value: this.mineralsInRange.duranium
                },
                {
                    item: "tritanium",
                    value: this.mineralsInRange.tritanium
                },
                {
                    item: "molybdenum",
                    value: this.mineralsInRange.molybdenum
                }
            ];
            let allValues = inRange.map(function(a) { return a.value });
            let sum = allValues.reduce(function (total, val) {
                return total + val;
            });
            let ship = vgap.getShip(sid);
            let hull = vgap.getHull(ship.hullid);
            let minCapacity = Math.floor(hull.cargo * autopilot.settings.disMinCapacity);
            if (sum >= minCapacity) demand = inRange;
            if (b.megacredits < 0) demand.push({ item: "megacredits", value: (b.megacredits * -1)});
        } else {
            if (b.duranium < 0) demand.push({ item: "duranium", value: (b.duranium * -1)});
            if (b.tritanium < 0) demand.push({ item: "tritanium", value: (b.tritanium * -1)});
            if (b.molybdenum < 0) demand.push({ item: "molybdenum", value: (b.molybdenum * -1)});
            if (b.megacredits < 0) demand.push({ item: "megacredits", value: (b.megacredits * -1)});
        }
        console.log(new autopilot.demandIndex(demand));
    } else if (ooi === "shb") {
        if (b.duranium < 0) demand.push({ item: "duranium", value: (b.duranium * -1)});
        if (b.tritanium < 0) demand.push({ item: "tritanium", value: (b.tritanium * -1)});
        if (b.molybdenum < 0) demand.push({ item: "molybdenum", value: (b.molybdenum * -1)});
        if (b.megacredits < 0) demand.push({ item: "megacredits", value: (b.megacredits * -1)});
    } else if (ooi === "stb") {
        let s = this.structures;
        let absFactoryDef = s.factories.finalTarget - s.factories.now;
        let absMineDef = s.mines.finalTarget - s.mines.now;
        let absDefenseDef = s.defense.finalTarget - s.defense.now;
        if (absFactoryDef > 0 || absMineDef > 0 || absDefenseDef > 0) {
            let cash = 0;
            let supplies = 0;
            let clans = 0;
            // supplies & cash
            if (absFactoryDef > 0) {
                supplies += absFactoryDef;
                cash += absFactoryDef * 3;
            }
            if (absMineDef > 0) {
                supplies += absMineDef;
                cash += absMineDef * 4;
            }
            if (s.defense.def > 0) {
                if (s.defense.def > s.defense.maxNow - s.defense.now)
                {
                    supplies += s.defense.maxNow - s.defense.now;
                    cash += (s.defense.maxNow - s.defense.now) * 10;
                } else {
                    supplies += s.defense.def;
                    cash += s.defense.def * 10;
                }
            }
            // assuming demand is already part of the balance, if there is more than 0 then there is enough.
            if (b.megacredits > 0) cash = 0;
            if (b.supplies > 0) supplies = 0;
            //
            // clans
            let clanDef = [this.minGrowthColPop];
            if (this.getOptLabor(true) > this.planet.clans) clanDef.push(this.getOptLabor(true) - this.planet.clans);
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
    return new autopilot.demandIndex(demand);
};
Colony.prototype.isBuilderMoneySource = function(aps, demand) {
    let isSource = false;
    let b = this.balance;
    let self = this;
    demand.forEach(function (d) {
        let obj = d.item;
        if (obj === "megacredits") {
            if (obj === "megacredits" && (aps.objectOfInterest === "stb" || aps.objectOfInterest === "bab") && self.hasStarbase && self.planet.megacredits - parseInt(autopilot.settings.defMcsRetention) > 0) {
                isSource = true;
            } else {
                if (b[obj] > 0) isSource = true;
            }
        }
    });
    return isSource;
};
Colony.prototype.isBuilderCargoSource = function (aps, demand) {
    let isSource = false;
    let b = this.balance;
    let self = this;
    demand.forEach(function (d) {
        let obj = d.item;
        if (obj !== "megacredits" && obj !== "neutronium") {
            if (aps.objectOfInterest === "fib") {
                if (b.supplies > 0 && b.tritanium > 0 && b.molybdenum > 0) isSource = true;
            } else {
                if (obj === "supplies" && aps.objectOfInterest === "stb" && self.hasStarbase && self.planet.supplies - parseInt(autopilot.settings.defSupRetention) > 0) {
                    isSource = true;
                } else if (obj === "clans") {
                    let minColPop = [self.minColPop, self.optNatTaxClans, self.optBovSupClans];
                    minColPop.sort(function(a, b) { return b - a });
                    if (self.planet.clans > minColPop[0]) isSource = true;
                } else {
                    if (b[obj] > 0) isSource = true;
                }
            }
        }
    });
    return isSource;
};
Colony.prototype.isBuilderSource = function (aps) {
    let demand = aps.demand.getApsDemand(aps);
    return this.isBuilderCargoSource(aps, demand) || this.isBuilderMoneySource(aps, demand);
};
// DISTRIBUTOR
Colony.prototype.isDistributorSource = function (aps) {
    return (this.balance[this.abrMoveables[aps.objectOfInterest]] > 0);
};
Colony.prototype.getDistributorCargo = function (ooi) {
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] > 0) return this.balance[obj];
    return 0;
};
Colony.prototype.getNextDistributorCargo = function (aps, nD) {
    let obj = this.abrMoveables[aps.objectOfInterest];
    if (this.balance[obj] + aps.ship[obj] > 0) return (this.balance[obj] + aps.ship[obj]);
    return 0;
};
Colony.prototype.getDistributorDemand = function (ooi) {
    let demand = [];
    let obj = this.abrMoveables[ooi];
    if (this.balance[obj] < 0) demand.push({ item: obj, value: (this.balance[obj] * -1)});
    return (new autopilot.demandIndex(demand));
};
/*
    INDICATORES
 */
Colony.prototype.drawStarbaseIndicators = function() {
    let p = this.planet;
    if (autopilot.settings.planetGFX) {
        let markup = {
            attr : {
                stroke : autopilot.idColors[autopilot.objectTypeEnum.BASES],
                lineWidth: 3,
                lineCap: "round",
                lineDash: false
            }
        };
        if (this.hasStarbase && !this.hasStarbase.isbuilding && !this.isFort) { // starbase (not a fort) is not building any ships
            autopilot.drawScaledQuarterCircle(p.x, p.y, 13, "nw", markup.attr, null, 0.5);
        } else if (!this.hasStarbase && this.isBuildingBase) { // current planet is ordered to build a starbase
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
    if (vgap.map.zoom > 3) {
        let markup = {
            attr : {
                stroke : "#e6e600",
                lineWidth: 3,
                lineCap: "round",
                lineDash: false
            }
        };
        if (this.taxation === "squeeze") {
            markup.attr.stroke = "#db0d47";
            autopilot.drawScaledQuarterCircle(p.x, p.y, 8, "nw", markup.attr, null, 0.5);
            autopilot.drawScaledQuarterCircle(p.x, p.y, 7, "nw", markup.attr, null, 0.5);
        } else if (this.taxation === "growth") {
            markup.attr.stroke = "#45ad08";
            autopilot.drawScaledQuarterCircle(p.x, p.y, 8, "nw", markup.attr, null, 0.5);
            autopilot.drawScaledQuarterCircle(p.x, p.y, 7, "nw", markup.attr, null, 0.5);
        }
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
            this.useShipNote = setup.useShipNote; // toDo: integrate into nu-Dashboard
            this.colScopeRange = setup.colScopeRange;
            this.colMinCapacity = setup.colMinCapacity;
            this.disScopeRange = setup.disScopeRange;
            this.disMinCapacity = setup.disMinCapacity;
            this.minSbFighters = setup.minSbFighters; // toDo: integrate into nu-Dashboard
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
        if (typeof this.minSbFighters === "undefined") this.minSbFighters = 20;
        if (typeof this.minSbDefense === "undefined") this.minSbDefense = 50;
        if (typeof this.defMcsRetention === "undefined") this.defMcsRetention = 50;
        if (typeof this.sbMcsRetention === "undefined") this.sbMcsRetention = 5000;
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
            minSbFighters: this.minSbFighters,
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
     *  Hover Info Overwrite
     */
    vgapMap.prototype.hitTextBox = function (c) {
        let q = "";
        q += "<div class='ItemSelectionBox minCorrection'>";
        if (c.isPlanet) {
            if (c.id < 0 && !vgap.editmode) {
                c = vgap.getPlanet(-c.id)
            }
            q += "<span>" + c.id + ": " + c.name;
            if (c.temp != -1) {
                q += "<span style='float:right;'>Temp: " + c.temp + "</span>"
            }
            q += "</span>";
            if (c.ispleasureplanet) {
                q += "<br/><span>Pleasure Planet</span>"
            }
            if (vgap.settings.isacademy) {
                q += "<table class='CleanTable' style='width: 100%'>"
            } else {
                q += "<table class='CleanTable'>"
            }
            if (c.infoturn == 0 && !vgap.godmode && !vgap.editmode) {
                q += this.hitText(c, c.isPlanet).replace("&nbsp", "")
            } else {
                if (vgap.settings.isacademy) {
                    if (c.nativeclans > 0) {
                        q += "<tr><td colspan='4'>" + addCommas(c.nativeclans * 100) + " " + c.nativeracename + " - " + c.nativegovernmentname + "</td></tr>"
                    }
                    q += "<tr> <td>Colonists: </td><td>&nbsp;" + addCommas(gsv(c.clans * 100)) + "&nbsp;</td><td>Duranium: </td><td>&nbsp;" + gsv(c.groundduranium) + "&nbsp;</td></tr><tr> <td>Tritanium: </td><td>&nbsp;" + gsv(c.groundtritanium) + "&nbsp;</td><td>Molybdenum: </td><td>&nbsp;" + gsv(c.groundmolybdenum) + "&nbsp;</td></tr>";
                    let n = vgap.getStarbase(c.id);
                    if (n != null && vgap.accountsettings.hoverstarbasestatus && (c.ownerid == vgap.player.id || vgap.fullallied(c.ownerid))) {
                        if (n.isbuilding) {
                            q += "<tr> <td colspan='4'>Build: " + vgap.getHull(n.buildhullid).name + "</td></tr>"
                        }
                    }
                } else {
                    let j = c.groundneutronium;
                    let b = c.groundduranium;
                    let p = c.groundtritanium;
                    let h = c.groundmolybdenum;
                    if (c.groundneutronium < 0 && c.totalneutronium > 0) {
                        j = c.totalneutronium;
                        b = c.totalduranium;
                        p = c.totaltritanium;
                        h = c.totalmolybdenum
                    }
                    if (c.nativeclans > 0) {
                        q += "<tr><td colspan='4'>" + addCommas(c.nativeclans * 100) + " " + c.nativeracename + " - " + c.nativegovernmentname + "</td></tr>"
                    }
                    q += "<tr>" + (vgap.gameUsesFuel() ? "<td>Neutronium: </td><td>&nbsp;" + gsv(c.neutronium) + " / " + gsv(j) + "&nbsp;</td>" : "") + "<td>Colonists: </td><td>&nbsp;" + addCommas(gsv(c.clans * 100)) + "</td></tr><tr> <td>Duranium: </td><td>&nbsp;" + gsv(c.duranium) + " / " + gsv(b) + "&nbsp;</td><td>Supplies: </td><td>&nbsp;" + gsv(c.supplies) + "</td></tr><tr> <td>Tritanium: </td><td>&nbsp;" + gsv(c.tritanium) + " / " + gsv(p) + (vgap.player.raceid != 12 ? "&nbsp;</td><td>Megacredits: </td><td>&nbsp;" + gsv(c.megacredits) + "</td>" : "") + "</tr><tr> <td>Molybdenum: </td><td>&nbsp;" + gsv(c.molybdenum) + " / " + gsv(h) + (vgap.player.raceid != 12 ? "&nbsp;</td><td>Friendly: </td><td>&nbsp;" + c.friendlycode + "</td>" : "") + "</tr>";
                    let n = vgap.getStarbase(c.id);
                    if (n != null && vgap.accountsettings.hoverstarbasestatus && (c.ownerid == vgap.player.id || vgap.fullallied(c.ownerid) || vgap.editmode)) {
                        q += "<tr> <td>Fighters: </td><td>&nbsp;" + n.fighters + "</td>";
                        if (n.starbasetype != 2) {
                            q += "<td colspan=2>Tech: H-" + n.hulltechlevel + " E-" + n.enginetechlevel + " B-" + n.beamtechlevel + " T-" + n.torptechlevel + "</td></tr>";
                            if (n.isbuilding) {
                                q += "<tr> <td colspan='4'>Build: " + vgap.getHull(n.buildhullid).name + "</td></tr>"
                            }
                        } else {
                            q += "</tr>"
                        }
                    }
                }
                if (c.ownerid != vgap.player.id && c.ownerid != 0) {
                    let k = vgap.getPlayer(c.ownerid);
                    let l = vgap.getRace(k.raceid);
                    q += "<tr><td colspan='4'>" + l.name + " (" + k.username + ")</td></tr>"
                }
                q += this.hitText(c, c.isPlanet).replace("&nbsp", "")
            }
            q += "</table>"
        } else
        {
            if (c.id < 0) {
                c = vgap.getShip(-c.id)
            }
            let m = c;
            let e = vgap.getHull(m.hullid);
            let k = vgap.getPlayer(m.ownerid);
            let l = vgap.getRace(k.raceid);
            let d = "<span>" + m.id + ": " + m.name + "</span>";
            if (vgap.settings.isacademy) {
                if (m.ownerid == vgap.player.id || vgap.fullallied(m.ownerid)) {
                    d += "<table class='CleanTable' style='width: 100%'>";
                    d += "<tr><td>Colonists:</td><td>&nbsp;" + gsv(m.clans * 100) + "</td>";
                    if (m.torps > 0 || m.bays > 0) {
                        let a = "&nbsp;Fighters";
                        if (m.torps > 0) {
                            a = "&nbsp;Torpedos"
                        }
                        d += "<td>" + a + ":</td><td>&nbsp;" + gsv(m.ammo) + "</td>"
                    } else {
                        d += "</td></td>"
                    }
                    d += "</tr>";
                    if (m.ownerid == vgap.player.id) {
                        d += "<tr>";
                        d += "<td colspan='2'>" + vgap.getShipMissionShortText(m) + ((m.mission == 6 || m.mission == 7 || m.mission == 15 || m.mission == 20) && m.mission1target != 0 ? " " + m.mission1target : "") + "</td>";
                        if (m.iscloaked) {
                            d += "<td colspan='2' class='GoodText'>&nbsp;Cloaked</td>"
                        } else {
                            if (m.damage > 0) {
                                d += "<td>&nbsp;Damage:</td><td class='BadText'>&nbsp;" + m.damage + "</td>"
                            }
                        }
                        d += "</tr>"
                    } else {
                        if (m.iscloaked) {
                            d += "<tr><td/><td/><td colspan='2' class='GoodText'>&nbsp;Cloaked</td></tr>"
                        } else {
                            if (m.damage > 0) {
                                d += "<tr><td/><td/><td>&nbsp;Damage:</td><td class='BadText'>&nbsp;" + m.damage + "</td></tr>"
                            }
                        }
                    }
                    d += "</table>"
                } else {
                    d += "<table class='CleanTable' style='width: 100%'>";
                    d += "<tr><td>Heading:</td><td>&nbsp;" + gsv(m.heading) + "</td><td>Mass: </td><td>&nbsp;" + gsv(m.mass) + "</td></tr>";
                    d += "<tr><td colspan='4'>" + l.name + " (" + k.username + ")</td></tr>";
                    if (m.iscloaked) {
                        d += "<tr><td colspan='4' class='GoodText'>Cloaked</td></tr>"
                    }
                    d += "</table>"
                }
                q += d
            }
            else {
                let o = m.ammo + m.duranium + m.tritanium + m.molybdenum + m.supplies + m.clans;
                if (m.ownerid === vgap.player.id || vgap.fullallied(m.ownerid) || vgap.editmode) {
                    if ((m.ownerid == vgap.player.id && vgap.accountsettings.hoverownshiphull) || (vgap.fullallied(m.ownerid) && vgap.accountsettings.hoverallyshiphull)) {
                        d += "<div>" + e.name + "</div>"
                    }
                    d += "<table class='CleanTable'>";
                    if (m.hullid >= 200 && m.hullid < 300) {
                        d += "<tr><td style='text-transform:capitalize;'>" + vgap.podCargoType(m.hullid) + ":</td><td>&nbsp;" + gsv(m.clans) + " </td></tr>"
                    } else {
                        if (!vgap.accountsettings.hovershortform) {
                            if (vgap.gameUsesFuel()) {
                                d += "<tr><td>Neutronium:</td><td>&nbsp;" + gsv(m.neutronium) + "/" + e.fueltank + " </td><td>&nbsp;Clans:</td><td>&nbsp;" + gsv(m.clans) + "</td></tr>";
                                d += "<tr><td>Duranium:</td><td>&nbsp;" + gsv(m.duranium) + "</td><td>&nbsp;Supplies:</td><td>&nbsp;" + gsv(m.supplies) + "</td></tr>";
                                d += "<tr><td>Tritanium:</td><td>&nbsp;" + gsv(m.tritanium) + "</td><td>&nbsp;Megacredits:</td><td>&nbsp;" + gsv(m.megacredits) + "</td></tr>";
                                d += "<tr><td>Molybdenum:</td><td>&nbsp;" + gsv(m.molybdenum) + "</td>";
                                if (m.torps > 0 || m.bays > 0) {
                                    let a = "&nbsp;Fighters";
                                    if (m.torps > 0) {
                                        a = "&nbsp;Torpedos"
                                    }
                                    d += "<td>" + a + ":</td><td>&nbsp;" + gsv(m.ammo) + "</td>"
                                }
                                d += "</tr>"
                            } else {
                                d += "<tr><td>Duranium:</td><td>&nbsp;" + gsv(m.duranium) + "</td><td>&nbsp;Clans:</td><td>&nbsp;" + gsv(m.clans) + "</td></tr>";
                                d += "<tr><td>Tritanium:</td><td>&nbsp;" + gsv(m.tritanium) + "</td><td>&nbsp;Supplies:</td><td>&nbsp;" + gsv(m.supplies) + "</td></tr>";
                                d += "<tr><td>Molybdenum:</td><td>&nbsp;" + gsv(m.molybdenum) + "</td><td>&nbsp;Megacredits:</td><td>&nbsp;" + gsv(m.megacredits) + "</td></tr>";
                                if (m.torps > 0 || m.bays > 0) {
                                    let a = "Fighters";
                                    if (m.torps > 0) {
                                        a = "Torpedos"
                                    }
                                    d += "<tr><td>" + a + ":</td><td>&nbsp;" + gsv(m.ammo) + "</td></tr>"
                                }
                            }
                            if (vgap.accountsettings.hovershipstatus) {
                                if (m.ownerid != vgap.player.id && !vgap.editmode && !m.fullinfo) {
                                    if (m.iscloaked) {
                                        d += "<tr><td colspan='2' class='GoodText'>Cloaked</td></tr>"
                                    }
                                } else {
                                    if (m.ownerid == vgap.player.id || vgap.editmode || m.fullinfo) {
                                        d += "<tr>";
                                        d += "<td colspan='2'>" + vgap.getShipMissionShortText(m) + ((m.mission == 6 || m.mission == 7 || m.mission == 15 || m.mission == 20) && m.mission1target != 0 ? " " + m.mission1target : "") + "</td>";
                                        d += "<td>&nbsp;Friendly:</td><td>&nbsp;" + m.friendlycode + "</td>";
                                        d += "</tr>"
                                    }
                                    d += "<tr>";
                                    if (m.iscloaked) {
                                        d += "<td colspan='2' class='GoodText'>Cloaked</td>"
                                    } else {
                                        if (m.damage > 0) {
                                            d += "<td>Damage:</td><td class='BadText'>&nbsp;" + m.damage + "</td>"
                                        } else {
                                            d += "<td/><td/>"
                                        }
                                    }
                                    d += "<td colspan='2'>&nbsp;Warp " + m.warp + "</td>";
                                    d += "</tr>"
                                }
                            } else {
                                if (m.iscloaked) {
                                    d += "<tr><td colspan='2' class='GoodText'>Cloaked</td></tr>"
                                }
                            }
                            if ((c.ownerid != vgap.player.id && vgap.accountsettings.hoverallyplayer) || vgap.editmode) {
                                d += "<tr><td colspan='4'>" + l.name + " (" + k.username + ")</td></tr>"
                            }
                            d += this.hitText(c, c.isPlanet).replace("&nbsp", "")
                        } else {
                            d += "<tr>" + (vgap.gameUsesFuel() ? "<td>Neu:</td><td>&nbsp;" + gsv(m.neutronium) + " / " + e.fueltank + " </td><td>&nbsp;&nbsp;&nbsp;" : "<td>") + "Dur:</td><td>&nbsp;" + gsv(m.duranium) + "</td><td>&nbsp;&nbsp;&nbsp;Tri:</td><td>&nbsp;" + gsv(m.tritanium) + "</td><td>&nbsp;&nbsp;&nbsp;Mol:</td><td>&nbsp;" + gsv(m.molybdenum) + "</td></tr>";
                            d += "<tr><td>MC:</td><td>&nbsp;" + gsv(m.megacredits) + "</td><td>&nbsp;&nbsp;&nbsp;Cln:</td><td>&nbsp;" + gsv(m.clans) + "</td><td>&nbsp;&nbsp;&nbsp;Sup:</td><td>&nbsp;" + gsv(m.supplies) + "</td>";
                            if (m.torps > 0 || m.bays > 0) {
                                let a = "Ftr";
                                if (m.torps > 0) {
                                    a = "Tor"
                                }
                                d += "<td>&nbsp;&nbsp;&nbsp;" + a + ":</td><td>&nbsp;" + gsv(m.ammo) + "</td>"
                            }
                            d += "</tr>";
                            if (vgap.accountsettings.hovershipstatus) {
                                if (m.ownerid != vgap.player.id && !vgap.editmode && !m.fullinfo) {
                                    if (m.iscloaked) {
                                        d += "<tr><td colspan='2' class='GoodText'>Cloaked</td></tr>"
                                    }
                                } else {
                                    d += "<tr>";
                                    if (m.ownerid == vgap.player.id || vgap.editmode || m.fullinfo) {
                                        d += "<td colspan='2'>" + vgap.getShipMissionShortText(m) + ((m.mission == 6 || m.mission == 7 || m.mission == 15 || m.mission == 20) && m.mission1target != 0 ? " " + m.mission1target : "") + "</td>"
                                    } else {
                                        d += "<td/><td/>"
                                    }
                                    if (m.iscloaked) {
                                        d += "<td colspan='2' class='GoodText'>&nbsp;&nbsp;&nbsp;Cloaked</td>"
                                    } else {
                                        if (m.damage > 0) {
                                            d += "<td>&nbsp;&nbsp;&nbsp;Dmg:</td><td class='BadText'>&nbsp;" + m.damage + "</td>"
                                        } else {
                                            d += "<td/><td/>"
                                        }
                                    }
                                    d += "<td colspan='2'>&nbsp;&nbsp;&nbsp;Warp " + m.warp + "</td>";
                                    if (m.ownerid == vgap.player.id || vgap.editmode || m.fullinfo) {
                                        d += "<td>&nbsp;&nbsp;&nbsp;FC:</td><td>&nbsp;" + m.friendlycode + "</td>"
                                    }
                                    d += "</tr>"
                                }
                            } else {
                                if (m.iscloaked) {
                                    d += "<tr><td colspan='2' class='GoodText'>Cloaked</td></tr>"
                                }
                            }
                            if ((c.ownerid != vgap.player.id && vgap.accountsettings.hoverallyplayer) || vgap.editmode) {
                                d += "<tr><td colspan='8'>" + l.name + " (" + k.username + ")</td></tr>"
                            }
                            d += this.hitText(c, c.isPlanet, 8).replace("&nbsp", "")
                        }
                    }
                    // ############## APS INFO ##############
                    let aps = autopilot.apsShips.findById(m.id);
                    if (aps) {
                        d += "<tr><td colspan='8' class='GoodText'>APS " + autopilot.apsOOItext[aps.shipFunction].name + " " + autopilot.apsOOItext[aps.shipFunction][aps.ooiPriority] + "</td></tr>";
                        if (aps.secondaryDestination) {
                            d += "<tr><td colspan='2'>Base: " + aps.base + "</td><td colspan='6'>Target: " + aps.secondaryDestination + ", " + aps.destination + "</td></tr>";
                        } else {
                            d += "<tr><td colspan='2'>Base: " + aps.base + "</td><td colspan='6'>Target: " + aps.destination + "</td></tr>";
                        }
                        if (aps.idle) {
                            d += "<tr><td colspan='8' class='BadText'>APS idle! " + aps.idleReason.join(", ") + "</td></tr>";
                        }
                    }
                    // ############## APS INFO ##############
                    d += "</table>"
                }
                else {
                    d += "<div>" + e.name + "</div>";
                    d += "<table class='CleanTable'>";
                    d += "<tr><td>Heading:</td><td>&nbsp;" + gsv(m.heading) + " at Warp: " + gsv(m.warp) + "</td></tr>";
                    d += "<tr><td>Mass: </td><td>&nbsp;" + gsv(m.mass) + "</td></tr>";
                    d += "<tr><td colspan='2'>" + l.name + " (" + k.username + ")</td></tr>";
                    if (vgap.player.raceid == 7) {
                        for (let f = 0; f < vgap.messages.length; f++) {
                            let g = vgap.messages[f];
                            if (g.messagetype == 12 && g.target == m.id) {
                                d += "<tr><td>Web Report: </td><td>OUT OF FUEL</td></tr>";
                                break
                            }
                        }
                    }
                    if (m.iscloaked) {
                        d += "<tr><td colspan='2' class='GoodText'>Cloaked</td></tr>"
                    }
                    d += this.hitText(c, c.isPlanet).replace("&nbsp", "");
                    d += "</table>"
                }
                q += d
            }
        }
        q += "</div>";
        return q
    };
    /*
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
            let a = new Array();
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
        let a = new Array();
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
                let a = new Array();
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
            let a = new Array();
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
        let appFunctions = [
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
        let appData = autopilot.planeteers.findById(vgap.planetScreen.planet.id);

        $("<div id='OrdersScreen'><h1>Planetary Missions</h1></div>").appendTo(vgap.more);
        //
        for (let a = 0; a < appFunctions.length; a++)
        {
            let c = appFunctions[a];

            let cDisplayName = c.name;

            if (appData && c.field && appData[c.field] !== "off") cDisplayName = c.nameActive;

            let setPlanetMission = function (option, field) {
                return function () {
                    if (typeof option !== "undefined") {
                        console.log("Setting " + field + " to " + option);
                        let updatedData;
                        if (appData) {
                            appData[field] = option;
                        } else {
                            let appData = {
                                pid: vgap.planetScreen.planet.id
                            };
                            appData[field] = option;
                        }
                        updatedData = new APPdata(appData);
                        autopilot.planeteers.update(vgap.planetScreen.planet.id, updatedData.getData());
                        autopilot.planeteers.save();
                        let cC = autopilot.getColony(vgap.planetScreen.planet.id);
                        cC.update(true); // apply (new) orders
                        cC.updateBalance();
                    }
                    vgap.closeMore();
                };
            };
            if (c.options) {
                $("<div>" + cDisplayName + "<span>" + c.desc + "<br/>Options: <b id='mOptions" + c.id + "'></b></span></div>").tclick(setPlanetMission()).appendTo("#OrdersScreen");
                Object.keys(c.options).forEach(
                    function(key) {
                        let setPlanetMission = function (option, field) {
                            return function () {
                                if (typeof option === "undefined") return;
                                console.log("Setting " + field + " to " + option);
                                let updatedData;
                                if (appData) {
                                    appData[field] = option;
                                } else {
                                    let appData = {
                                        pid: vgap.planetScreen.planet.id
                                    };
                                    appData[field] = option;
                                }
                                updatedData = new APPdata(appData);
                                autopilot.planeteers.update(vgap.planetScreen.planet.id, updatedData.getData());
                                autopilot.planeteers.save();
                                let cC = autopilot.getColony(vgap.planetScreen.planet.id);
                                cC.update(true); // apply (new) orders
                                cC.updateBalance();
                                return false;
                            };
                        };
                        let cOptionStyle = "color:cyan;font-size:10px;text-decoration:underline;";
                        if (appData && c.field && appData[c.field] === key) cOptionStyle = "color:cyan;font-size: 10px;text-decoration:overline;";
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
	vgapShipScreen.prototype.load = function(c) {
        this.ship = c;
        this.ship.changed = 1;
        this.hull = vgap.getHull(c.hullid);
        let d = vgap.shipsAt(c.x, c.y);
        this.ships = d;
        this.showShipLocHistory = vgap.accountsettings.shiphistdef;
        this.shippath = 0;
        this.shipdestination = nu.t.none;
        this.starbase = null;
        this.planet = vgap.planetAt(c.x, c.y);
        if (this.planet != null) {
            this.starbase = vgap.getStarbase(this.planet.id)
        }
        this.missions = this.getMissionArray(c);
        let b = [];
        if (this.hull.id == 39 || this.hull.id == 41 || this.hull.id == 1034 || this.hull.id == 1039 || this.hull.id == 1041) {
            b.push({title: "pop - " + nu.t.activateglorydevice, desc: nu.t.popdef, code: "pop"});
            b.push({title: "trg - " + nu.t.triggerglorydevice, desc: nu.t.trgdef, code: "trg"})
        }
        if (c.torps > 0 || c.bays > 0) {
            b.push({title: "ntp - " + nu.t.notorpedosfighters, desc: nu.t.ntpdef, code: "ntp"})
        }
        if (c.torps > 0) {
            b.push({title: "mkt - " + nu.t.maketorpedos, desc: nu.t.mktdef, code: "mkt"});
            b.push({title: "msc - " + nu.t.minescoop, desc: nu.t.mscdef, code: "msc"});
            b.push({title: "btt - " + nu.t.beamtransfertorps, desc: nu.t.bttdef, code: "btt"})
        }
        if (c.bays > 0) {
            b.push({title: "btf - " + nu.t.beamtransferfighters, desc: nu.t.btfdef, code: "btf"})
        }
        b.push({title: "btm - " + nu.t.beamtransfermoney, desc: nu.t.btmdef, code: "btm"});
        if (this.planet != null) {
            b.push({title: "bdm - " + nu.t.beamdownmoney, desc: nu.t.bdmdef + this.planet.name + ".", code: "bdm"})
        }
        if (c.bays > 0 && (vgap.player.raceid == 9 || vgap.player.raceid == 10 || vgap.player.raceid == 11)) {
            b.push({title: "lfm - " + nu.t.loadfighterminerals, desc: nu.t.lfmdef, code: "lfm"})
        }
        if (this.hull.id == 105 || this.hull.id == 104 || this.hull.id == 97) {
            b.push({title: "nal - " + nu.t.noalchemy, desc: nu.t.naldef, code: "nal"})
        }
        if (this.hull.id == 105) {
            b.push({title: "ald - " + nu.t.allduranium, desc: nu.t.alddef, code: "ald"});
            b.push({title: "alt - " + nu.t.alltritanium, desc: nu.t.altdef, code: "alt"});
            b.push({title: "alm - " + nu.t.allmolybdenum, desc: nu.t.almdef, code: "alm"});
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
            b.push({title: "nbr - " + nu.t.noboardingparty, desc: nu.t.nbrdef, code: "nbr"})
        }
        this.fcodes = b;
        this.screen = new leftContent("ShipScreen", c.id + ": " + c.name, c, function () {
            vgap.map.deselectShip()
        });
        this.screen.addFleetView();
        this.predictor(c);
        if (vgap.settings.isacademy) {
            c.warp = 1;
            let a = [];
            a.push({
                name: nu.t.mission, onclick: function () {
                    vgap.shipScreen.shipMission()
                }
            });
            if (this.planet != null) {
                if (this.planet.ownerid == vgap.player.id || c.clans > 0 || c.transferclans > 0) {
                    a.push({
                        name: "Colonists", onclick: function () {
                            vgap.shipScreen.academyClans()
                        }
                    })
                }
                if (this.starbase != null && this.planet.ownerid == vgap.player.id) {
                    if (c.torps > 0) {
                        a.push({
                            name: "Torpedos", onclick: function () {
                                vgap.shipScreen.academyTorps()
                            }
                        })
                    }
                    if (c.bays > 0) {
                        a.push({
                            name: "Fighters", onclick: function () {
                                vgap.shipScreen.academyFighters()
                            }
                        })
                    }
                }
            }
            this.screen.addSection("ShipStatus", "Actions", a, function () {
                return vgap.shipScreen.loadAcademy()
            }, "hull-" + c.hullid)
        } else
        {
            if (vgap.editmode) {
                let a = levelbuilder.getEditButtons(this);
                this.screen.addSection("LevelBuilder", "", a, function () {
                    return ""
                })
            }
            let a = [];
            if (this.hull.id != 112) {
                a.push({
                    name: nu.t.name, onclick: function () {
                        vgap.shipScreen.changeName()
                    }
                })
            }
            if (c.hullid >= 200 && c.hullid < 300) {
                a = new Array()
            }
            a.push({
                name: nu.t.notes, onclick: function () {
                    shtml.editNote(c.id, 2)
                }, id: "NoteButton"
            });
            this.screen.addSection("ShipStatus", this.hull.name, a, function () {
                return vgap.shipScreen.loadStatus()
            }, "hull-" + c.hullid);
            if (vgap.hasNote(c.id, 2)) {
                $("#NoteButton").addClass("GoodText")
            }
            if (c.hullid < 200 || c.hullid >= 300) {
                let a = new Array();
                if (this.planet != null || d.length > 1) {
                    a.push({
                        name: nu.t.transfer, onclick: function () {
                            vgap.shipScreen.transfer()
                        }
                    })
                }
                if (this.planet == null) {
                    a.push({
                        name: nu.t.jettison, onclick: function () {
                            vgap.shipScreen.jettison()
                        }
                    })
                } else {
                    if (this.planet.ownerid === this.ship.ownerid) {
                        a.push({
                            name: "Unload", onclick: function () {
                                vgap.shipScreen.unload()
                            }
                        })
                    }
                }
                if (c.hullid >= 200 && c.hullid < 300) {
                    a = [];
                }
                if (vgap.player.raceid != 12) {
                    this.screen.addSection("ShipCargo", nu.t.cargo, a, function () {
                        return vgap.shipScreen.loadCargo()
                    })
                }
            }
            a = [];
            a.push({
                name: nu.t.speed, onclick: function () {
                    vgap.shipScreen.warpSpeed()
                }
            });
            if (this.ship.hullid == 51 || this.ship.hullid == 87 || this.ship.hullid == 77 || this.ship.hullid == 110) {
                a.push({
                    name: "Hyperjump", onclick: function () {
                        vgap.shipScreen.hyperjump()
                    }
                })
            }
            if (this.ship.hullid == 56 || this.ship.hullid == 1055) {
                a.push({
                    name: "Warp Chunnel", onclick: function () {
                        vgap.shipScreen.chunnel()
                    }
                })
            }
            if (this.ship.hullid == 114) {
                a.push({
                    name: "Temporal Lance", onclick: function () {
                        vgap.shipScreen.temporalLance()
                    }
                })
            }
            if (this.ship.hullid == 109 || this.ship.hullid == 1049 || this.ship.hullid == 1023) {
                a.push({
                    name: "Chameleon", onclick: function () {
                        vgap.shipScreen.chameleon()
                    }
                })
            }
            a.push({
                name: nu.t.history, onclick: function () {
                    vgap.shipScreen.showShipLocHistory = !vgap.shipScreen.showShipLocHistory;
                    vgap.map.draw()
                }
            });
            if (c.hullid >= 200 && c.hullid < 300) {
                a = new Array()
            }
            this.screen.addSection("ShipMovement", nu.t.movement, a, function () {
                return vgap.shipScreen.loadMovement()
            }, "navigation");
            if (c.hullid < 200 || c.hullid > 300) {
                let a = new Array();
                if (vgap.player.raceid != 12) {
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
                        onclick: function () {
                            vgap.shipScreen.changeFriendly()
                        }
                    })
                }
                a.push({
                    name: nu.t.mission, onclick: function () {
                        vgap.shipScreen.shipMission()
                    }
                });
                if (vgap.player.raceid != 12) {
                    a.push({
                        name: nu.t.enemy, onclick: function () {
                            vgap.shipScreen.primaryEnemy()
                        }
                    })
                } else {
                    if (this.planet != null || d.length > 1) {
                        a.push({
                            name: nu.t.transfer, onclick: function () {
                                vgap.shipScreen.transfer()
                            }
                        })
                    }
                    if (this.planet == null) {
                        a.push({
                            name: nu.t.jettison, onclick: function () {
                                vgap.shipScreen.jettison()
                            }
                        })
                    }
                }
                this.screen.addSection("ShipOrders", nu.t.orders, a, function () {
                    return vgap.shipScreen.loadOrders()
                })
            }
            if (c.artifacts) {
                this.screen.addArtifacts()
            }
        }
        vgap.callPlugins("loadship");
        vgap.hotkeysOn = true;
        vgap.showTip("shipscreenopen");
        vgap.showTip("hull" + c.hullid);
        vgap.action();
    };
	// display APC order selection dialog
	vgapShipScreen.prototype.autopilotControl = function() {
		let apcOptions = [
			{
				name: "Collector",
                nameActive: "<strong>> Collecting</strong>",
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
				ooiOptions: [ "neu", "cla", "mcs" ],
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
				name: "Expander",
                nameActive: "<strong>> Expanding</strong>",
				desc: "Colonize unowned planets",
				shipFunction: "exp",
                shipMission: false,
				ooiOptions: [ "slw", "fst" ],
                action: false,
				hullId: 0
			},
            {
                name: "Terraformer",
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
		let curMission = vgap.shipScreen.ship.mission;
        let isAPS = autopilot.shipIsAps(vgap.shipScreen.ship.id);

		vgap.more.empty();
        $("<div id='OrdersScreen'><h1>nuPilot-Control</h1></div>").appendTo(vgap.more);
		//
        for (let a = 0; a < apcOptions.length; a++)
		{
            if (this.planet || apcOptions[a].action)
            {
                let c = apcOptions[a];
                let cName = c.name;
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
                let setShipFunction = function (func, ooiPriority, action, shipMission) {
                    return function () {
                        let oShipMission = vgap.shipScreen.ship.mission;
                        if (shipMission) oShipMission = shipMission;
                        let cfgData = autopilot.apsShips.findById(vgap.shipScreen.ship.id);
                        if (action && cfgData) {
                            autopilot.apsShips.deactivate(vgap.shipScreen.ship.id);
                            autopilot.apsShips.save();
                        } else if (func && ooiPriority) {
                            if (!cfgData) {
                                let baseId = 0;
                                let planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                let targetPlanet = vgap.planetAt(vgap.shipScreen.ship.targetx, vgap.shipScreen.ship.targety);
                                if (planet) baseId = planet.id;
                                if (planet && targetPlanet && planet.id !== targetPlanet.id) baseId = targetPlanet.id;
                                let data = {
                                    sid: vgap.shipScreen.ship.id,
                                    base: baseId,
                                    shipFunction: func,
                                    oShipMission: oShipMission,
                                    ooiPriority: ooiPriority
                                };
                                let newAPS = new APSdata(data);
                                autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                            } else {
                                autopilot.apsShips.deactivate(vgap.shipScreen.ship.id);
                                autopilot.apsShips.save();
                                //
                                let baseId = 0;
                                let planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                let targetPlanet = vgap.planetAt(vgap.shipScreen.ship.targetx, vgap.shipScreen.ship.targety);
                                if (planet) baseId = planet.id;
                                if (planet && targetPlanet && planet.id !== targetPlanet.id) baseId = targetPlanet.id;
                                let data = {
                                    sid: vgap.shipScreen.ship.id,
                                    base: baseId,
                                    shipFunction: func,
                                    oShipMission: oShipMission,
                                    ooiPriority: ooiPriority
                                };
                                let newAPS = new APSdata(data);
                                autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                            }
                        }
                        vgap.shipScreen.selectMission(curMission);
                    };
                };
                if (c.ooiOptions.length > 1) {
                    $("<div>" + cName + "<span>" + c.desc + "<br/>Priority: <b id='ooiPriority" + c.shipFunction + "'></b></span></div>").tclick(setShipFunction(false, false, false)).appendTo("#OrdersScreen");
                    for (let j = 0; j < c.ooiOptions.length; j++) {
                        let setShipFunctionOoi = function (func, ooiPriority, shipMission) {
                            return function () {
                                let oShipMission = vgap.shipScreen.ship.mission;
                                if (shipMission) oShipMission = shipMission;
                                let cfgData = autopilot.apsShips.findById(vgap.shipScreen.ship.id);
                                if (!cfgData) {
                                    let baseId = 0;
                                    let planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                    let targetPlanet = vgap.planetAt(vgap.shipScreen.ship.targetx, vgap.shipScreen.ship.targety);
                                    let destination = false;
                                    if (planet) baseId = planet.id;
                                    if (planet && targetPlanet && planet.id !== targetPlanet.id) {
                                        if (func === "exp" || func === "bld" || func === "dis") {
                                            destination = targetPlanet.id;
                                        } else {
                                            baseId = targetPlanet.id;
                                        }
                                    }
                                    let data = {
                                        sid: vgap.shipScreen.ship.id,
                                        base: baseId,
                                        destination: destination,
                                        shipFunction: func,
                                        oShipMission: oShipMission,
                                        ooiPriority: ooiPriority
                                    };
                                    let newAPS = new APSdata(data);
                                    autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                                    //vgap.shipScreen.refresh();
                                } else {
                                    autopilot.apsShips.deactivate(vgap.shipScreen.ship.id);
                                    autopilot.apsShips.save();
                                    //
                                    let baseId = 0;
                                    let planet = vgap.planetAt(vgap.shipScreen.ship.x, vgap.shipScreen.ship.y);
                                    let targetPlanet = vgap.planetAt(vgap.shipScreen.ship.targetx, vgap.shipScreen.ship.targety);
                                    let destination = false;
                                    if (planet) baseId = planet.id;
                                    if (planet && targetPlanet && planet.id !== targetPlanet.id) {
                                        if (func === "exp" || func === "bld" || func === "dis") {
                                            destination = targetPlanet.id;
                                        } else {
                                            baseId = targetPlanet.id;
                                        }
                                    }
                                    let data = {
                                        sid: vgap.shipScreen.ship.id,
                                        base: baseId,
                                        destination: destination,
                                        shipFunction: func,
                                        oShipMission: oShipMission,
                                        ooiPriority: ooiPriority
                                    };
                                    let newAPS = new APSdata(data);
                                    autopilot.setupAPS(vgap.shipScreen.ship.id, newAPS.getData()); // runs ALL PHASES
                                    //vgap.shipScreen.refresh();
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
        let apcFunctions = {
			col: "Collect",
			dis: "Distribute",
            bld: "Build",
			exp: "Colonize",
            ter: "Terraform",
            hiz: "Hizzz-Collect",
			alc: "Alchemy"
		};
        let apcPrio = {};
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
            cla: "Clans",
            mcs: "Megacredits"
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
		let h = "";
        let apcData = autopilot.apsShips.findById(r.id);
		if (apcData) {
            let ooi = apcData.ooiPriority;
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
        let u = this.ship;
        let m = "<table width='100%'>";
        let h = nu.t.none;
        if (u.enemy > 0) {
            let r = vgap.getPlayer(u.enemy);
            let s = vgap.getRace(r.raceid);
            h = s.name + " (" + r.username + ")"
        }
        if (vgap.player.raceid != 12) {
            m += "<tr><td class='widehead' data-topic='map-ship'>" + nu.t.primaryenemy + ":</td><td class='textval'>" + h + "</td></tr></table>"
        }
        m += "<table width='100%'><tr><td class='widehead' data-topic='ship-missions'>" + nu.t.mission + ":</td><td class='textval'>";
        let p = null;
        if (u.mission1target != 0) {
            p = vgap.getShip(u.mission1target)
        }
        if (u.mission == 6 && p != null && u.x == p.x && u.y == p.y) {
            m += "Tow ship " + p.id + ": " + p.name.substr(0, 30)
        } else
        {
            if (u.mission == 6) {
                m += "Tow: <span class=BadText>No Target</span>"
            } else {
                if (u.mission == 7 && p != null) {
                    m += "Intercept ship " + p.id + ": " + p.name.substr(0, 30)
                } else {
                    if (u.mission == 7) {
                        m += "Intercept: <span class=BadText>No Target</span>"
                    } else {
                        if (u.mission == 20 && p != null) {
                            m += "Cloak and Intercept ship " + p.id + ": " + p.name.substr(0, 30)
                        } else {
                            if (u.mission == 20) {
                                m += "Cloak and Intercept: <span class=BadText>No Target</span>"
                            } else {
                                if (u.mission == 15 && p != null) {
                                    m += "Repair ship " + p.id + ": " + p.name.substr(0, 30)
                                } else {
                                    if (u.mission == 15) {
                                        m += "Repair: <span class=BadText>No Target</span>"
                                    } else {
                                        if (u.mission == 18 && (u.mission1target == null || u.mission1target == 0)) {
                                            m += "Send Fighters to All Receivers"
                                        } else {
                                            if (u.mission == 18) {
                                                let t = "<span class=BadText>Invalid Target</span>";
                                                if (u.mission1target < 1000 && u.mission1target > -1000) {
                                                    let p = vgap.getShip(u.mission1target);
                                                    if (p != null) {
                                                        t = p.id + ": " + p.name
                                                    }
                                                } else {
                                                    let q = vgap.getPlanet(u.mission1target % 1000);
                                                    if (q != null) {
                                                        t = q.id + ": " + q.name
                                                    }
                                                }
                                                m += "Send Fighters to " + t
                                            } else {
                                                if (u.mission == 24) {
                                                    let t = "<span class=BadText>Invalid Target</span>";
                                                    let q = this.planet;
                                                    if (q != null) {
                                                        t = q.id + ": " + q.name
                                                    }
                                                    let b = "<span class=BadText>Invalid Artifact</span>";
                                                    if (q && q.artifacts) {
                                                        let a = vgap.getArray(q.artifacts, u.mission2target);
                                                        if (a) {
                                                            b = a.name
                                                        }
                                                    }
                                                    m += "Load " + b + " from " + t
                                                } else {
                                                    if (u.mission == 25) {
                                                        let t = "<span class=BadText>Invalid Target</span>";
                                                        if (u.mission1target == 0) {
                                                            let q = this.planet;
                                                            if (q != null) {
                                                                t = q.id + ": " + q.name
                                                            }
                                                        } else {
                                                            let p = vgap.getShip(u.mission1target);
                                                            if (p != null) {
                                                                t = p.id + ": " + p.name
                                                            }
                                                        }
                                                        let b = "<span class=BadText>Invalid Artifact</span>";
                                                        if (u.artifacts) {
                                                            let a = vgap.getArray(u.artifacts, u.mission2target);
                                                            if (a) {
                                                                b = a.name
                                                            }
                                                        }
                                                        m += "Transfer " + b + " to " + t
                                                    } else {
                                                        if (u.mission == 2 || (u.mission == 8 && vgap.player.raceid == 7)) {
                                                            let v = this.getMineUnits(u);
                                                            m += this.getMission(u.mission).name + " <span class='valsup'>(convert " + u.minelaytorps + " torps into " + v + " " + (u.mission == 2 ? "" : "web ") + "mines)</span>"
                                                        } else {
                                                            m += this.getMission(u.mission).name
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
        if (u.mission == 1) {
            let c = u.beamid;
            if (vgap.player.raceid == 12) {
                c = Math.floor((u.clans / vgap.getHull(u.hullid).cargo) * 9) + 1
            }
            m += " <span class='valsup'>(" + u.beams * c * c * 4 + " mines / " + u.beams * c * c * 3 + " web mines)</span>"
        }
        if (u.mission == 9 || (vgap.player.raceid == 3 && u.mission == 8)) {
            m += " <span class='valsup'>(" + vgap.cloakFuel(u) + " fuel / turn)</span>"
        }
        m += "</td></tr>";
        m += "</table>";

        // ###### auto pilot control info ######
        m += vgap.shipScreen.autopilotInfo(this.ship);
        // #####################################

        let d = null;
        if (u.hullid == 1023 || u.hullid == 109 || u.hullid == 1049) {
            let f = parseInt(u.friendlycode);
            let e = vgap.getHull(f);
            if (e != null && e.id != 0) {
                d = e
            }
        }
        if (vgap.player.raceid != 12) {
            let k = "transparent";
            let l = u.friendlycode.toUpperCase();
            if (l == "HYP" && (u.hullid == 51 || u.hullid == 87 || u.hullid == 77 || u.hullid == 110)) {
                k = "yellow"
            } else
                {
                if (l == "BDM" || l == "BTM") {
                    k = "limegreen"
                } else {
                    if (vgap.settings.fcodesbdx && l.match(/BD[0-9HQ]/)) {
                        k = "limegreen"
                    } else {
                        if (l == "NAL" && (u.hullid == 97 || u.hullid == 104 || u.hullid == 105)) {
                            k = "red"
                        } else {
                            if ((l == "ALT" || l == "ALD" || l == "ALM") && u.hullid == 105) {
                                k = "orange"
                            } else {
                                if (vgap.settings.fcodesextraalchemy && (l == "NAT" || l == "NAD" || l == "NAM") && u.hullid == 105) {
                                    k = "orange"
                                } else {
                                    if (l == "NTP" || l == "NBR") {
                                        k = "orchid"
                                    } else {
                                        if (l == "MKT" || l == "LFM") {
                                            k = "orange"
                                        } else {
                                            if ((l == "POP" || l == "TRG") && (u.hullid == 39 || u.hullid == 41 || u.hullid == 1034 || u.hullid == 1039 || u.hullid == 1041)) {
                                                k = "red"
                                            } else {
                                                if (l == "MSC") {
                                                    k = "aqua"
                                                } else {
                                                    if (l == "BTT" || l == "BTF") {
                                                        k = "lightcoral"
                                                    } else {
                                                        if (l.match(/GS[1-9A-Z]/)) {
                                                            k = "magenta"
                                                        } else {
                                                            if (l.match(/MD[0-9HQA]/)) {
                                                                k = "#099"
                                                            } else {
                                                                if (l.match(/MI[1-9A-Z]/)) {
                                                                    k = "orange"
                                                                } else {
                                                                    if (d) {
                                                                        k = "magenta"
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
            if (d) {
                m += "<table width='100%'><tr><td class='widehead' data-topic='friendly-codes'>Chameleon:</td><td class='textval' style='color:magenta;'>" + d.name + " <span class='valsup'>(10 fuel / turn)</span></td><td class='fc'><span style='background-color: " + k + "'  id='ShipFC'>" + u.friendlycode + "</span></td></tr></table>"
            } else {
                m += "<table width='100%'><tr><td class='widehead' data-topic='friendly-codes'>" + nu.t.friendlycode + ":</td><td class='fc'><span style='background-color: " + k + "'  id='ShipFC'>" + u.friendlycode + "</span></td></tr></table>"
            }
            if (vgap.advActive(61)) {
                let g = 0;
                for (let n = 0; n < vgap.messages.length; n++) {
                    let o = vgap.messages[n];
                    if (o.target == u.id && o.messagetype == 20 && o.body.indexOf("ship nearby") >= 0) {
                        g++
                    }
                }
                if (g > 0) {
                    m += "<table width='100%'><tr><td class='widehead' data-topic='friendly-codes'>Dark Sense:</td><td class='textval' style='color:magenta;'>" + g + " hidden ships nearby</td></tr></table>"
                }
            }
        }
        return m;
    };
    /*
     *  DASHBOARD OVERWRITE
     */
	// display NuPilot Information & Settings (Dashboard)
    vgapDashboard.prototype.saveNuPilotCollectorSettings = function()
    {
        let nupSettings = autopilot.loadGameSettings();
        if ($( "#autoRange" ).prop( "checked" ))
        {
            nupSettings.colScopeRange = "auto";
        } else
        {
            let input = parseFloat($( "#autoRange" ).val());
            nupSettings.colScopeRange = input;
        }
        let input = parseFloat($( "#minResolve" ).val());
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
        let nupSettings = autopilot.loadGameSettings();
        console.log(nupSettings);

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        let a = $("<div id='colSettings'></div>").appendTo(this.pane);
        // Intro
        $("<div>A nuPilot collector once activated considers the current planet as his base and will collect one specific resource or focus on building minerals ('all').</div>").appendTo(a);
        // Settings
        let ul = $("<ul></ul>").appendTo(a);
        // scope range
        let scopeRange = nupSettings.colScopeRange;
        let checked = "";
        let rangeValue = scopeRange;
        if (scopeRange === "auto") {
            checked = "checked";
            rangeValue = "";
        }
        $("<li>Scope Range: The radius in which the nuPilot will look for resources.</li>").appendTo(ul);
        let scopeRangeUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='autoRange'>Auto:</label><input type='checkbox' id='autoRange' " + checked + "> or <label for='range'>Range:</label><input type='text' id='range' value='" + rangeValue + "'></li>").appendTo(scopeRangeUL);
        // minimum resolve factor
        let minCapacity = nupSettings.colMinCapacity;
        $("<li>Minimum Capacity: The minimum capacity (cargo / fuel / megacredits) a nuPilot should use for a mission. 1 for 100 % (only collect full cargo loads), 0.9 for 90 %, etc.</li>").appendTo(ul);
        let minResolveUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='minResolve'>Minimum Capacity:</label><input type='text' id='minResolve' value='" + minCapacity + "'></li>").appendTo(minResolveUL);
        // save button
        ul = $("<button onclick='vgap.dash.saveNuPilotCollectorSettings();'>Save</button>").appendTo(a);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.saveNuPilotGeneralSettings = function()
    {
        let nupSettings = autopilot.loadGameSettings();
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
        let nupSettings = autopilot.loadGameSettings();
        //console.log(nupSettings);

        let checked = "";

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        let a = $("<div id='genSettings'><hr></div>").appendTo(this.pane);
        let ul = $("<ul></ul>").appendTo(a);

        // turn on / off planetary indicators
        let planetGFX = nupSettings.planetGFX;
        $("<li>Display planetary info and indicators: </li>").appendTo(ul);
        let pGFXul = $("<ul></ul>").appendTo(ul);
        if (planetGFX) checked = "checked";
        $("<li><label for='pGFX'>On</label><input type='checkbox' id='pGFX' " + checked + "></li>").appendTo(pGFXul);
        checked = "";

        // turn on / off ship indicators
        let shipGFX = nupSettings.shipGFX;
        $("<li>Display ship indicators: </li>").appendTo(ul);
        let sGFXul = $("<ul></ul>").appendTo(ul);
        if (shipGFX) checked = "checked";
        $("<li><label for='sGFX'>On</label><input type='checkbox' id='sGFX' " + checked + "></li>").appendTo(sGFXul);
        checked = "";

        // turn on / off ship indicators
        let shipUseNote = nupSettings.useShipNote;
        $("<li>Use ship note for mission details: </li>").appendTo(ul);
        let sUseNoteUl = $("<ul></ul>").appendTo(ul);
        if (shipUseNote) checked = "checked";
        $("<li><label for='sUseNote'>On</label><input type='checkbox' id='sUseNote' " + checked + "></li>").appendTo(sUseNoteUl);
        checked = "";

        let planetMng = nupSettings.planetMNG;
        let pDefDef = nupSettings.defPlanetDef;
        let pSbDefDef = nupSettings.defPlanetSbDef;
        let pFortDefDef = nupSettings.defPlanetFortDef;
        // turn on / off planetary manager
        $("<li>Planetary manager (sets taxes, build targets and builds structures): </li>").appendTo(ul);
        let pMNGul = $("<ul></ul>").appendTo(ul);
        if (planetMng) checked = "checked";
        $("<li><label for='pMNG'>On</label><input type='checkbox' id='pMNG' " + checked + "></li>").appendTo(pMNGul);
        let pMNGOptionsUl = $("<ul></ul>").appendTo(pMNGul);
        $("<li><label for='pMNGdefDef'>Default planetary defense</label>: <input type='text' id='pMNGdefDef' value='" + pDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);
        $("<li><label for='pMNGaddSbDef'>Additional defense for planets with starbase</label>: <input type='text' id='pMNGaddSbDef' value='" + pSbDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);
        $("<li><label for='pMNGaddFrtDef'>Additional defense for fortified planets</label>: <input type='text' id='pMNGaddFrtDef' value='" + pFortDefDef + "' style='width: 50px;'></li>").appendTo(pMNGOptionsUl);

        // Retention Settings
        let dMR = nupSettings.defMcsRetention; // default megacredit retention
        let sbMR = nupSettings.sbMcsRetention; // default megacredit retention @ starbase
        let dSR = nupSettings.defSupRetention; // default supplies retention
        let sbSR = nupSettings.sbSupRetention; // default supplies retention @ starbase
        let dNR = nupSettings.defNeuRetention; // default fuel retention
        let sbNR = nupSettings.sbNeuRetention; // default fuel retention @ starbase
        let fNR = nupSettings.frtNeuRetention; // default fuel retention @ fort

        let hr2 = $("<div><hr></div>").appendTo(this.pane);
        $("<h3>Retention Values</h3>").appendTo(hr2);
        let table = $("<table></table>").appendTo(hr2);
        let tr = $("<tr></tr>").appendTo(table);
        let td = $("<td width='20%'></td>").appendTo(tr);
        $("<div>How much of ... should be retained @planet, @fortified planet or @starbase planet? " +
            "<br>Collectors and Distributors will respect these values in terms of cargo. When it comes to using fuel (Neutronium), corresponding retention values are ignored." +
            "<br>Expanders and Builders only adhere to the default (@planet) retention values.</div>").appendTo(td);

        let td2 = $("<td></td>").appendTo(tr);
        let table2 = $("<table></table>").appendTo(td2);
        $("<tr><td><label for='defMcsRetention'>Megacredits:</label></td><td><input type='text' id='defMcsRetention' value='" + dMR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbMcsRetention'></label></td><td><input type='text' id='sbMcsRetention' value='" + sbMR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);
        $("<tr><td><label for='defSupRetention'>Supply:</label></td><td><input type='text' id='defSupRetention' value='" + dSR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbSupRetention'></label></td><td><input type='text' id='sbSupRetention' value='" + sbSR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);
        $("<tr><td><label for='defNeuRetention'>Neutronium:</label></td><td><input type='text' id='defNeuRetention' value='" + dNR + "' style='width: 50px;'></td><td>@Planet</td></tr>").appendTo(table2);
        $("<tr><td><label for='frtNeuRetention'></label></td><td><input type='text' id='frtNeuRetention' value='" + sbNR + "' style='width: 50px;'></td><td>@Fort</td></tr>").appendTo(table2);
        $("<tr><td><label for='sbNeuRetention'></label></td><td><input type='text' id='sbNeuRetention' value='" + fNR + "' style='width: 50px;'></td><td>@Starbase</td></tr>").appendTo(table2);

        let hr3 = $("<div><hr></div>").appendTo(this.pane);
        // save button
        ul = $("<button onclick='vgap.dash.saveNuPilotGeneralSettings();'>Save</button>").appendTo(hr3);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.saveNuPilotDistributorSettings = function()
    {
        let nupSettings = autopilot.loadGameSettings();
        if ($( "#autoRange" ).prop( "checked" ))
        {
            nupSettings.disScopeRange = "auto";
        } else
        {
            let input = parseFloat($( "#autoRange" ).val());
            nupSettings.disScopeRange = input;
        }
        let input = parseFloat($( "#minResolve" ).val());
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
        let nupSettings = autopilot.loadGameSettings();

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        let a = $("<div id='colSettings'></div>").appendTo(this.pane);
        // Intro
        $("<div>A nuPilot distributor once activated will start to distribute one specific resource or everything possible using clan deficiencies as primer.</div>").appendTo(a);
        // Settings
        let ul = $("<ul></ul>").appendTo(a);
        // scope range
        let scopeRange = nupSettings.disScopeRange;
        let checked = "";
        let rangeValue = scopeRange;
        if (scopeRange === "auto") {
            checked = "checked";
            rangeValue = "";
        }
        $("<li>Scope Range: The radius in which the nuPilot will look for resources.</li>").appendTo(ul);
        let scopeRangeUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='autoRange'>Auto:</label><input type='checkbox' id='autoRange' " + checked + "> or <label for='range'>Range:</label><input type='text' id='range' value='" + rangeValue + "'></li>").appendTo(scopeRangeUL);
        // minimum resolve factor
        let minCapacity = nupSettings.disMinCapacity;
        $("<li>Minimum Capacity: The minimum capacity (cargo / fuel / megacredits) a nuPilot should use for a mission. 1 for 100 % (only distribute full cargo loads), 0.9 for 90 %, etc.</li>").appendTo(ul);
        let minResolveUL = $("<ul></ul>").appendTo(ul);
        $("<li><label for='minResolve'>Minimum Capacity:</label><input type='text' id='minResolve' value='" + minCapacity + "'></li>").appendTo(minResolveUL);
        // save button
        ul = $("<button onclick='vgap.dash.saveNuPilotCollectorSettings();'>Save</button>").appendTo(a);
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
