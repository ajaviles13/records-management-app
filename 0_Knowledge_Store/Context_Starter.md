# Platform Description 
We are building a robust, efficient, and secure web application that will accelerate my clients document tracking process
 
# Requirements:
- We will have vertically stacked tab options on the left of the screen. At the fixed bottom of this will be a "Profile" tab reflecting the current signed in user
- Dashboard analytics for both internal and external sharing
- Report Generator for
 

# Tech Stack
- Frontend: React
- Backend: Python Lambda Serverless
- Auth: AWS Cognito
- Database: DynamoDB
- Deployment: Vercel
- Analytics: Leverage EventBridge t 

# Tab Descriptions
- "Records": This will be the tab that display the tabular row data for each document that is going through review or completed review
- "My Snapshot": This will display some high level numbers about the user that is logged in (e.g., "Documents In-Review", "Documents Completed", "Documents On-Hold")
- "Audit Log": This will display the tabular row data of all the changes that have been made to a record in the "sla-file-records" DynamoDB Table 
- "Dashboard": This will display data visualization charts 
- "Account": This will simply be the users account view when they click on it. This will contain more user settings information

# Definitions
- "Logged In View": This is the main app interface that the user sees right when they successfully log in
- "Tab Views": These are the side lift panel tab options that each user role type will be able to see and interact with
-

# Roles Based Access Control
User Based Roles:
- “Analyst”: Company analyst is able to read/write to the "" table
    a. 
- "Manager": Company admin that can perform specific tasks like generating reports
- "Super Admin": This will be me
- "Viewer": Can only view and interact with any custom dashboards built into the platform



Side bar options based on User Role:
- "Analyst"
    1. "Documents"
    2. ""
    3. ""

