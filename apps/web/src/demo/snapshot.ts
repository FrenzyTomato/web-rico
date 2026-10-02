import type { PlayerBroadcast } from '@vibe-rico/protocol';

// Frozen mid-game projection from the recorded three-player game at revision 185.
export const demoSnapshot = {
  "protocolVersion": "1",
  "revision": 185,
  "events": [],
  "legalActions": [],
  "view": {
    "seatOrder": [
      "alice",
      "bruno",
      "chen"
    ],
    "governorPlayerId": "chen",
    "roundNumber": 18,
    "roleSelectionIndex": 0,
    "roleCards": [
      {
        "instanceId": "role-1",
        "kind": "planter",
        "accumulatedCoins": 0,
        "selectedBy": null
      },
      {
        "instanceId": "role-2",
        "kind": "recruiter",
        "accumulatedCoins": 2,
        "selectedBy": null
      },
      {
        "instanceId": "role-3",
        "kind": "builder",
        "accumulatedCoins": 0,
        "selectedBy": null
      },
      {
        "instanceId": "role-4",
        "kind": "craftsman",
        "accumulatedCoins": 0,
        "selectedBy": null
      },
      {
        "instanceId": "role-5",
        "kind": "trader",
        "accumulatedCoins": 1,
        "selectedBy": null
      },
      {
        "instanceId": "role-6",
        "kind": "captain",
        "accumulatedCoins": 0,
        "selectedBy": "chen"
      }
    ],
    "phase": {
      "kind": "captain-loading",
      "actorId": "chen",
      "roleChooserId": "chen",
      "actorIndex": 0,
      "captainBonusUsed": false,
      "consecutiveNoLoads": 0
    },
    "supply": {
      "goods": {
        "corn": 3,
        "fruit": 11,
        "sugar": 8,
        "tobacco": 5,
        "coffee": 9
      },
      "workerCount": 22,
      "workRegisterCount": 3,
      "quarryCount": 8,
      "buildingStock": {
        "small-fruit-depot": 3,
        "small-sugar-mill": 2,
        "large-fruit-depot": 1,
        "large-sugar-mill": 2,
        "large-tobacco-storage": 0,
        "large-coffee-roaster": 2,
        "small-market": 0,
        "hacienda": 0,
        "builders-yard": 2,
        "small-warehouse": 0,
        "hospital": 1,
        "office": 1,
        "large-market": 2,
        "large-warehouse": 2,
        "factory": 2,
        "school": 2,
        "harbor": 2,
        "wharf": 2,
        "fire-station": 1,
        "residence": 1,
        "fortress": 1,
        "customs-house": 1,
        "city-hall": 1
      },
      "vpRemaining": 34,
      "vpOverflow": 0
    },
    "estateMarket": [
      {
        "instanceId": "estate-sugar-3",
        "kind": "sugar"
      },
      {
        "instanceId": "estate-fruit-1",
        "kind": "fruit"
      },
      {
        "instanceId": "estate-coffee-8",
        "kind": "coffee"
      },
      {
        "instanceId": "estate-corn-8",
        "kind": "corn"
      }
    ],
    "estateDiscard": [
      {
        "instanceId": "estate-fruit-7",
        "kind": "fruit"
      },
      {
        "instanceId": "estate-sugar-1",
        "kind": "sugar"
      },
      {
        "instanceId": "estate-fruit-3",
        "kind": "fruit"
      },
      {
        "instanceId": "estate-fruit-8",
        "kind": "fruit"
      },
      {
        "instanceId": "estate-corn-1",
        "kind": "corn"
      },
      {
        "instanceId": "estate-fruit-2",
        "kind": "fruit"
      },
      {
        "instanceId": "estate-corn-9",
        "kind": "corn"
      },
      {
        "instanceId": "estate-fruit-12",
        "kind": "fruit"
      }
    ],
    "endTriggers": [],
    "ships": [
      {
        "instanceId": "ship-4",
        "capacity": 4,
        "goodType": "corn",
        "loadedCount": 3
      },
      {
        "instanceId": "ship-5",
        "capacity": 5,
        "goodType": null,
        "loadedCount": 0
      },
      {
        "instanceId": "ship-6",
        "capacity": 6,
        "goodType": "tobacco",
        "loadedCount": 2
      }
    ],
    "tradingHouse": [
      "corn",
      "sugar"
    ],
    "players": [
      {
        "playerId": "alice",
        "coins": 1,
        "countryside": [
          {
            "instanceId": "estate-fruit-11",
            "kind": "fruit",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-9",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-5",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-11",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-6",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-tobacco-7",
            "kind": "tobacco",
            "occupied": true
          },
          {
            "instanceId": "estate-tobacco-5",
            "kind": "tobacco",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-10",
            "kind": "sugar",
            "occupied": true
          }
        ],
        "buildings": [
          {
            "instanceId": "building-large-sugar-mill-1",
            "buildingTypeId": "large-sugar-mill",
            "occupiedSlots": 3
          },
          {
            "instanceId": "building-large-fruit-depot-1",
            "buildingTypeId": "large-fruit-depot",
            "occupiedSlots": 3
          },
          {
            "instanceId": "building-office-1",
            "buildingTypeId": "office",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-small-warehouse-1",
            "buildingTypeId": "small-warehouse",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-large-tobacco-storage-2",
            "buildingTypeId": "large-tobacco-storage",
            "occupiedSlots": 3
          },
          {
            "instanceId": "building-hospital-1",
            "buildingTypeId": "hospital",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-small-market-2",
            "buildingTypeId": "small-market",
            "occupiedSlots": 0
          }
        ],
        "idleWorkerCount": 0,
        "goods": {
          "corn": 0,
          "fruit": 0,
          "sugar": 1,
          "tobacco": 2,
          "coffee": 0
        },
        "personalShip": null
      },
      {
        "playerId": "bruno",
        "coins": 0,
        "countryside": [
          {
            "instanceId": "estate-fruit-9",
            "kind": "fruit",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-8",
            "kind": "sugar",
            "occupied": true
          },
          {
            "instanceId": "estate-tobacco-1",
            "kind": "tobacco",
            "occupied": true
          },
          {
            "instanceId": "estate-coffee-4",
            "kind": "coffee",
            "occupied": true
          },
          {
            "instanceId": "estate-sugar-7",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-corn-2",
            "kind": "corn",
            "occupied": true
          },
          {
            "instanceId": "estate-coffee-5",
            "kind": "coffee",
            "occupied": true
          },
          {
            "instanceId": "estate-tobacco-4",
            "kind": "tobacco",
            "occupied": false
          }
        ],
        "buildings": [
          {
            "instanceId": "building-small-sugar-mill-1",
            "buildingTypeId": "small-sugar-mill",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-large-fruit-depot-2",
            "buildingTypeId": "large-fruit-depot",
            "occupiedSlots": 3
          },
          {
            "instanceId": "building-small-warehouse-2",
            "buildingTypeId": "small-warehouse",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-large-tobacco-storage-3",
            "buildingTypeId": "large-tobacco-storage",
            "occupiedSlots": 0
          },
          {
            "instanceId": "building-hacienda-2",
            "buildingTypeId": "hacienda",
            "occupiedSlots": 0
          }
        ],
        "idleWorkerCount": 0,
        "goods": {
          "corn": 1,
          "fruit": 0,
          "sugar": 1,
          "tobacco": 0,
          "coffee": 0
        },
        "personalShip": null
      },
      {
        "playerId": "chen",
        "coins": 1,
        "countryside": [
          {
            "instanceId": "estate-corn-3",
            "kind": "corn",
            "occupied": true
          },
          {
            "instanceId": "estate-corn-10",
            "kind": "corn",
            "occupied": true
          },
          {
            "instanceId": "estate-sugar-2",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-tobacco-9",
            "kind": "tobacco",
            "occupied": false
          },
          {
            "instanceId": "estate-tobacco-8",
            "kind": "tobacco",
            "occupied": false
          },
          {
            "instanceId": "estate-coffee-2",
            "kind": "coffee",
            "occupied": false
          },
          {
            "instanceId": "estate-fruit-5",
            "kind": "fruit",
            "occupied": false
          },
          {
            "instanceId": "estate-fruit-6",
            "kind": "fruit",
            "occupied": false
          },
          {
            "instanceId": "estate-sugar-4",
            "kind": "sugar",
            "occupied": false
          },
          {
            "instanceId": "estate-coffee-6",
            "kind": "coffee",
            "occupied": false
          },
          {
            "instanceId": "estate-corn-6",
            "kind": "corn",
            "occupied": false
          },
          {
            "instanceId": "estate-coffee-3",
            "kind": "coffee",
            "occupied": false
          }
        ],
        "buildings": [
          {
            "instanceId": "building-hacienda-1",
            "buildingTypeId": "hacienda",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-small-market-1",
            "buildingTypeId": "small-market",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-large-tobacco-storage-1",
            "buildingTypeId": "large-tobacco-storage",
            "occupiedSlots": 3
          },
          {
            "instanceId": "building-small-sugar-mill-2",
            "buildingTypeId": "small-sugar-mill",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-small-fruit-depot-1",
            "buildingTypeId": "small-fruit-depot",
            "occupiedSlots": 1
          },
          {
            "instanceId": "building-large-coffee-roaster-1",
            "buildingTypeId": "large-coffee-roaster",
            "occupiedSlots": 0
          }
        ],
        "idleWorkerCount": 0,
        "goods": {
          "corn": 2,
          "fruit": 0,
          "sugar": 0,
          "tobacco": 0,
          "coffee": 0
        },
        "personalShip": null
      }
    ],
    "viewer": {
      "playerId": "alice",
      "earnedVp": 2
    }
  }
} as unknown as PlayerBroadcast;
