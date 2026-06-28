# Intent Classification Patterns

Edit this file to customize how user requests are classified. Each row defines a keyword pattern and the credentials required if matched.

## External Keyword Patterns

| KeywordPattern | CredentialKey | CredentialLabel | CredentialReason |
|---|---|---|---|
| \b(github\|git\|repo\|repository\|push\|commit\|clone)\b | github_token | GitHub Personal Access Token | Needed to create repositories, push code, or interact with GitHub on your behalf. |
| \b(vercel\|deploy\|deployment)\b | vercel_token | Vercel API Token | Required to deploy the project to Vercel. |
| \b(slack\|webhook\|notification)\b | slack_webhook | Slack Webhook URL | Needed to send notifications or messages to a Slack channel. |
| \b(openai\|gpt\|chatgpt\|llm\|ai\s*key\|gemini\|claude)\b | ai_api_key | AI Provider API Key | External AI service required to fulfill this request. |
| \b(database\|postgres\|mysql\|mongodb\|redis\|supabase\|firebase)\b | database_url | Database Connection String | A database connection is needed to store or retrieve data for this task. |
| \b(api\s*key\|token\|secret\|credential\|auth\|oauth\|login\|password)\b | api_credentials | API Credentials (Key/Token) | This task requires external API access that needs authentication. |
| \b(aws\|s3\|ec2\|lambda\|cloud\|azure\|gcp\|google\s*cloud)\b | cloud_credentials | Cloud Provider Credentials | Cloud infrastructure access is required for this task. |
| \b(docker\|kubernetes\|k8s\|container\|registry)\b | container_registry | Container Registry Credentials | Container registry access needed to build and push images. |
| \b(stripe\|payment\|invoice\|billing\|checkout)\b | stripe_api_key | Stripe API Key | Payment processing requires Stripe API access. |
| \b(twitter\|x\.com\|linkedin\|facebook\|instagram\|social\|discord)\b | social_api_key | Social Media API Credentials | Social media platform API access is required. |
| \b(mcp\|external\s*plugin\|plugin\|integration)\b | mcp_credentials | External Plugin/MCP Credentials | This task requires an external plugin or MCP integration that needs credentials. |

## External Action Indicators

These words indicate a request needs external access, even if no specific credential pattern matches:

- connect, integrate, deploy, push, send to, post to, upload, publish, host
