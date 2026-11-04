/* Run this script in SQL Server Management Studio as a user allowed to create databases. */
IF DB_ID(N'SmartTrashDB') IS NULL CREATE DATABASE SmartTrashDB;
GO
USE SmartTrashDB;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(180) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.TrashCans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrashCans (
    TrashCanID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    MacAddress VARCHAR(50) NOT NULL UNIQUE,
    Capacity FLOAT NOT NULL CONSTRAINT DF_TrashCans_Capacity DEFAULT 200,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_TrashCans_Status DEFAULT 'Offline',
    LocationName NVARCHAR(200) NULL,
    Latitude FLOAT NULL,
    Longitude FLOAT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_TrashCans_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.Telemetry', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Telemetry (
    TelemetryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    TrashCanID INT NOT NULL REFERENCES dbo.TrashCans(TrashCanID),
    FillLevel FLOAT NOT NULL,
    Temperature FLOAT NULL,
    Humidity FLOAT NULL,
    LidState NVARCHAR(20) NULL,
    RecordedAt DATETIME2 NOT NULL CONSTRAINT DF_Telemetry_RecordedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_Telemetry_Can_RecordedAt ON dbo.Telemetry(TrashCanID, RecordedAt DESC);
END;
GO

IF OBJECT_ID(N'dbo.WasteRecords', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WasteRecords (
    RecordID BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NULL REFERENCES dbo.Users(UserID),
    WasteType NVARCHAR(120) NOT NULL,
    Category NVARCHAR(80) NOT NULL,
    Confidence FLOAT NOT NULL CONSTRAINT DF_WasteRecords_Confidence DEFAULT 0,
    ClassificationMode NVARCHAR(20) NOT NULL CONSTRAINT DF_WasteRecords_Mode DEFAULT 'demo',
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WasteRecords_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.BinEvents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.BinEvents (
    EventID BIGINT IDENTITY(1,1) PRIMARY KEY,
    TrashCanID INT NULL REFERENCES dbo.TrashCans(TrashCanID),
    MacAddress VARCHAR(50) NOT NULL,
    EventType NVARCHAR(40) NOT NULL,
    DetectedLabel NVARCHAR(120) NULL,
    Category NVARCHAR(80) NULL,
    Confidence FLOAT NULL,
    ImageUrl NVARCHAR(500) NULL,
    FillLevel FLOAT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BinEvents_CreatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_BinEvents_CreatedAt ON dbo.BinEvents(CreatedAt DESC);
END;
GO

/* Demo seed data. Names and MAC addresses below are placeholders; replace with the real Raspberry Pi MAC. */
IF NOT EXISTS (SELECT 1 FROM dbo.TrashCans WHERE MacAddress = 'PI-DEMO-001')
  INSERT dbo.TrashCans (Name, MacAddress, Capacity, Status, LocationName) VALUES (N'EcoBin · Khu A', 'PI-DEMO-001', 200, 'Online', N'Khuôn viên');
IF NOT EXISTS (SELECT 1 FROM dbo.TrashCans WHERE MacAddress = 'PI-DEMO-002')
  INSERT dbo.TrashCans (Name, MacAddress, Capacity, Status, LocationName) VALUES (N'EcoBin · Khu B', 'PI-DEMO-002', 200, 'Online', N'Sảnh chính');
GO
