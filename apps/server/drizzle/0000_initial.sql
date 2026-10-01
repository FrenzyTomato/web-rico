CREATE TABLE "commands" (
	"room_id" text NOT NULL,
	"player_id" text NOT NULL,
	"command_id" text NOT NULL,
	"expected_revision" integer NOT NULL,
	"action" jsonb NOT NULL,
	"accepted_revision" integer NOT NULL,
	CONSTRAINT "commands_room_id_player_id_command_id_pk" PRIMARY KEY("room_id","player_id","command_id"),
	CONSTRAINT "commands_room_revision" UNIQUE("room_id","accepted_revision")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"room_id" text NOT NULL,
	"revision" integer NOT NULL,
	"event_index" integer NOT NULL,
	"event" jsonb NOT NULL,
	CONSTRAINT "events_room_id_revision_event_index_pk" PRIMARY KEY("room_id","revision","event_index")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"room_id" text PRIMARY KEY NOT NULL,
	"room_code" text NOT NULL,
	"host_player_id" text NOT NULL,
	"revision" integer NOT NULL,
	"seed" bigint,
	"initial_state" jsonb,
	"state" jsonb,
	"snapshot_schema_version" text,
	"snapshot_engine_version" text,
	CONSTRAINT "rooms_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"room_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"player_id" text NOT NULL,
	"display_name" text NOT NULL,
	"token_hash" text NOT NULL,
	CONSTRAINT "seats_room_id_player_id_pk" PRIMARY KEY("room_id","player_id"),
	CONSTRAINT "seats_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "seats_room_seat_index" UNIQUE("room_id","seat_index")
);
--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_room_id_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_room_id_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_room_id_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("room_id") ON DELETE cascade ON UPDATE no action;