Stakeholders:
- My Client: "Auracom"
- My client's client: "Molina Healthcare"
- Me: The technology developer and full owner of improving process efficiency, security, and visibility. I build everything

Background:
- My client provides a end-to-end document translation service for their clients
- My client uses several different vendor technologies to do this 
- I have a client that uses Google Sheets to track their full document review workflow.
- Molina sends English PDF or Word document to my client via FTP which then lands in Auracom's File Share (Egnyte)
- Auracom structures their file share in a way to manage their document assignment
- Auracom has a couple project managers and then several analysts that carry out the translation of documents
- All document translation work is done with a company called XTRX

Egnyte File Share structure:
- Auracom's project manager organizes their file share in a systematic way to stay organized when receiving, assigning, and finalizing documents
- Egnyte Folders and created based on the Business Unit within each Business Unit folder it consists of three subfolders "In_progress", "Inbound", and "Outbound" and then each of these subfolders contain two subfolders "TEST" and "PROD"
---- In_progress
-------- PROD
-------- TEST
---- Inbound
-------- PROD
-------- TEST
---- Outbound
-------- PROD
-------- TEST

Technology:
- File Share: Egnyte (https://developers.egnyte.com/integration/cfs/api-docs/overview)
- Google Sheets
- Google Apps Script

Current Workflow:
1. Molina sends documents from their portal "PEGA" to Auracom via FTP
2. The files land in Auracom's File Share
3. The Project Manager then goes and reviews everything and manually creates subfolders and move documents as needs to fit their systematic file foldering schema. As you work down the folder structure, you will end up at a Analyst Assigned folder (e.g., "7.29.BN.AS" is assigned to Analyst "AS" on July 29th, BN stands for the language Bengali ISO 639-1 (2-letter))
4. The Project Manager then lets the Analysts know that their folders are ready and to start translating documents
5. The Analysts then go into the Google SLA Tracking sheet and performs the "Received" function to auto import the files metadata into the Google Sheet for tracking
6. When the Analysts are done translating their documents they put the translated documents in a folder and then run the "Delivered" script to update all File names with their Date file delivered metadata

Current State:
- The Google Sheets SLA Tracker works and the team loves it but their a technology drawbacks:
a. There are several Language Tabs in a single Google Sheet where each Language tab has the same schema and table attributes making adding new attributes or changes cumbersome/limited
b. Reporting is very complex as all the data is spread across several google sheet tabs and google sheets
c. There is little to no Permissioning with Roles Base logic

Future State (Phase 1):
- Build a secure web application:
a. Gives Project Managers a single view of assigning documents to Analysts and calling Egnytes APIs on the backend to perform any file moving / folder creation logic (we will use Egnyte as the File Storage system for the First Phase). They can also generate reports or see a dashboard of everything inclduing an Audit Log
b. Gives Analysts a single view of all their assigned documents, the status of each, and better capabilities to view, track, update, and manage their assigned documents for translation
c. Gives Clients a single dashboard view of everything that is going on