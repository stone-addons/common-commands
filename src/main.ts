const system = server.registerSystem(0, 0);
const str = JSON.stringify.bind(JSON);
server.log("CommonCommands Activated");
function getName(entity: IEntity) {
  return system.getComponent<INameableComponent>(entity, MinecraftComponent.Nameable).data.name;
}
const db = new SQLite3();
db.exec("CREATE TABLE tpa(source, target, timestamp)");
function clearOutdatedEntries() {
  db.update("DELETE FROM tpa WHERE timestamp < $current - 60000", {
    $current: new Date().getTime()
  });
}
system.registerPolicy("custom:tpa");
system.registerCommand("tpa", {
  description: "send teleport request to player",
  permission: 0,
  overloads: [
    {
      parameters: [
        {
          type: "player",
          name: "target"
        }
      ],
      handler([arr]) {
        if (!this.entity || this.entity.__identifier__ != "minecraft:player") throw `Can only be used by player`;
        if (arr.length != 1) throw `Cannot send teleport request to ${arr.length} player(s).`;
        const target = arr[0];
        clearOutdatedEntries();
        const sqlParams = {
          $source: str(this.entity),
          $target: str(target),
          $current: new Date().getTime()
        };
        if (
          !system.checkPolicy(
            "custom:tpa",
            {
              source: this.entity,
              target
            },
            true
          )
        ) {
          return "you don't have permission to send tpa request";
        }
        if (db.query("SELECT * FROM tpa WHERE source=$source OR target=$target", sqlParams).length > 0) {
          throw `there is a pending tpa request between you and target`;
        }
        db.update("INSERT INTO tpa VALUES($source, $target, $current)", sqlParams);
        system.sendText(
          target,
          `${this.name} want to teleport to your position, using /tpaccept to allow this request and /tpdeny to disallow this request.`
        );
        return `sent to ${getName(target)}`;
      }
    } as CommandOverload<["player"]>
  ]
});

system.registerCommand("tpaccept", {
  description: "accept tpa request",
  permission: 0,
  overloads: [
    {
      parameters: [],
      handler() {
        if (!this.entity || this.entity.__identifier__ != "minecraft:player") throw `Can only be used by player`;
        clearOutdatedEntries();
        const result = db.query("SELECT * FROM tpa WHERE target=$target", {
          $target: str(this.entity)
        });
        if (result.length == 0) throw `there is no pending tpa request`;
        const source = JSON.parse(result[0].source as string);
        const targetPos = system.getComponent(this.entity, MinecraftComponent.Position);
        system.applyComponentChanges(source, targetPos);
        return "teleported";
      }
    } as CommandOverload<[]>
  ]
});

system.registerCommand("tpdeny", {
  description: "accept tpa request",
  permission: 0,
  overloads: [
    {
      parameters: [],
      handler() {
        if (!this.entity || this.entity.__identifier__ != "minecraft:player") throw `Can only be used by player`;
        clearOutdatedEntries();
        const result = db.query("SELECT * FROM tpa WHERE target=$target", {
          $target: str(this.entity)
        });
        if (result.length == 0) throw `there is no pending tpa request`;
        const source = JSON.parse(result[0].source as string);
        system.sendText(source, "Target player denied your teleport request");
        db.update("DELETE FROM tpa WHERE target=$target", {
          $target: str(this.entity)
        });
        return "removed";
      }
    } as CommandOverload<[]>
  ]
});

system.registerCommand("setlore", {
  description: "Set lore for current item",
  permission: 1,

  overloads: [
    {
      parameters: [
        {
          type: "string",
          name: "lore"
        }
      ],
      handler([str]) {
        if (!this.entity || !system.hasComponent(this.entity, MinecraftComponent.HandContainer))
          throw `Can only be used by entity that has hand container`;
        const hand = system.getComponent<IHandContainerComponent>(this.entity, MinecraftComponent.HandContainer);
        const item = hand.data[0];
        server.log(JSON.stringify(item));
        const old = system.getComponent(item, MinecraftComponent.Lore);
        old.data = [str];
        system.applyComponentChanges(item, old);
        return "done";
      }
    } as CommandOverload<["string"]>
  ]
});

system.registerCommand("setextrablock", {
  description: "Set extra block at specify position",
  permission: 1,
  overloads: [
    {
      parameters: [
        {
          type: "position",
          name: "pos"
        },
        {
          type: "block",
          name: "block"
        }
      ],

      handler([pos, block]) {
        if (!this.entity || !system.hasComponent(this.entity, MinecraftComponent.TickWorld)) throw `Can only be used by entity that has tick world`;
        const tick = system.getComponent<ITickWorldComponent>(this.entity, MinecraftComponent.TickWorld);
        server.log(JSON.stringify(tick));
        system.setExtraBlock(tick.data.ticking_area, block, pos);
      }
    } as CommandOverload<["position", "block"]>
  ]
});
