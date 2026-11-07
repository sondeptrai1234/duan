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
    OrganicFillLevel FLOAT NULL,
    InorganicFillLevel FLOAT NULL,
    Temperature FLOAT NULL,
    Humidity FLOAT NULL,
    LidState NVARCHAR(20) NULL,
    OrganicLidState NVARCHAR(20) NULL,
    InorganicLidState NVARCHAR(20) NULL,
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
    ImageUrl NVARCHAR(500) NULL,
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
    BinCompartment NVARCHAR(120) NULL,
    Confidence FLOAT NULL,
    ImageUrl NVARCHAR(500) NULL,
    FillLevel FLOAT NULL,
    InstructionsJson NVARCHAR(MAX) NULL,
    DisposalMethod NVARCHAR(1000) NULL,
    Note NVARCHAR(1000) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BinEvents_CreatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_BinEvents_CreatedAt ON dbo.BinEvents(CreatedAt DESC);
END;
GO

/* One physical EcoBin with two separate compartments: organic and inorganic. */
IF NOT EXISTS (SELECT 1 FROM dbo.TrashCans WHERE MacAddress = 'PI-NHOM4-001')
  INSERT dbo.TrashCans (Name, MacAddress, Capacity, Status, LocationName) VALUES (N'EcoBin · 2 ngăn', 'PI-NHOM4-001', 200, 'Offline', N'Thiết bị Nhom4');
GO

/* Default Admin Account: admin / admin123 */
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'admin@nhom4.vn')
  INSERT dbo.Users (FullName, Email, PasswordHash) VALUES (N'Admin Nhóm 4', 'admin@nhom4.vn', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:7c43f80888aec4f243a0260d244acb67ec6cf57fbd24d638206bd49f858714c66d1f344dfc0fd966549384e2021176646919ef63add209a8201a7ee09fab58f1');
GO

-- Upgrade existing databases created by earlier project versions (SQL Server 2012 compatible).
IF COL_LENGTH(N'dbo.WasteRecords', N'ImageUrl') IS NULL
  ALTER TABLE dbo.WasteRecords ADD ImageUrl NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.Telemetry', N'OrganicFillLevel') IS NULL
  ALTER TABLE dbo.Telemetry ADD OrganicFillLevel FLOAT NULL;
IF COL_LENGTH(N'dbo.Telemetry', N'InorganicFillLevel') IS NULL
  ALTER TABLE dbo.Telemetry ADD InorganicFillLevel FLOAT NULL;
IF COL_LENGTH(N'dbo.Telemetry', N'OrganicLidState') IS NULL
  ALTER TABLE dbo.Telemetry ADD OrganicLidState NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.Telemetry', N'InorganicLidState') IS NULL
  ALTER TABLE dbo.Telemetry ADD InorganicLidState NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.BinEvents', N'BinCompartment') IS NULL
  ALTER TABLE dbo.BinEvents ADD BinCompartment NVARCHAR(120) NULL;
IF COL_LENGTH(N'dbo.BinEvents', N'InstructionsJson') IS NULL
  ALTER TABLE dbo.BinEvents ADD InstructionsJson NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.BinEvents', N'DisposalMethod') IS NULL
  ALTER TABLE dbo.BinEvents ADD DisposalMethod NVARCHAR(1000) NULL;
IF COL_LENGTH(N'dbo.BinEvents', N'Note') IS NULL
  ALTER TABLE dbo.BinEvents ADD Note NVARCHAR(1000) NULL;
GO
