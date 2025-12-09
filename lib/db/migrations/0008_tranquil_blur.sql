CREATE TABLE IF NOT EXISTS "FileMetadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" varchar(32) NOT NULL,
	"fileType" varchar(128) NOT NULL,
	"blobUrl" text NOT NULL,
	"headers" json NOT NULL,
	"rowCount" varchar(32) NOT NULL,
	"sheetNames" json,
	"encoding" varchar(32),
	"uploadedAt" timestamp NOT NULL,
	"processedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NotebookState" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"title" text NOT NULL,
	"cells" jsonb NOT NULL,
	"fileReferences" json NOT NULL,
	"e2bSessionId" varchar(128),
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FileMetadata" ADD CONSTRAINT "FileMetadata_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NotebookState" ADD CONSTRAINT "NotebookState_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
