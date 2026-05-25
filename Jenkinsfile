pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 40, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'RUN_FRONTEND_LINT', defaultValue: true, description: 'Run frontend lint after services are healthy')
  }

  environment {
    COMPOSE_PROJECT_NAME = "duyi-${env.JOB_BASE_NAME}-${env.BUILD_NUMBER}"
    COMPOSE_FILES = "-f docker-compose.yml -f docker-compose.jenkins.yml"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare Env Files') {
      steps {
        withCredentials([
          file(credentialsId: 'duyi-server-env', variable: 'SERVER_ENV_FILE')
        ]) {
          sh '''
            set -euo pipefail
            cp "$SERVER_ENV_FILE" server/.env.ci
            chmod 600 server/.env.ci

            if [ ! -f frontend/.env.local ]; then
              cat > frontend/.env.local <<'EOT'
NEXT_PUBLIC_BACKEND_URL=http://localhost:7001
BACKEND_URL=http://server:7001
EOT
            fi
          '''
        }
      }
    }

    stage('Build Images') {
      steps {
        sh '''
          set -euo pipefail
          docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" build
        '''
      }
    }

    stage('Start Services') {
      steps {
        sh '''
          set -euo pipefail
          docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" up -d
        '''
      }
    }

    stage('Health Check') {
      steps {
        sh '''
          set -euo pipefail

          for i in $(seq 1 30); do
            if docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" exec -T server sh -c 'wget -q -T 2 -O - http://127.0.0.1:7001/ >/dev/null'; then
              echo "Server is healthy"
              break
            fi
            if [ "$i" -eq 30 ]; then
              echo "Server health check failed"
              exit 1
            fi
            sleep 2
          done

          for i in $(seq 1 30); do
            if docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" exec -T frontend sh -c 'wget -q -T 2 -O - http://127.0.0.1:3000/ >/dev/null'; then
              echo "Frontend is healthy"
              break
            fi
            if [ "$i" -eq 30 ]; then
              echo "Frontend health check failed"
              exit 1
            fi
            sleep 2
          done
        '''
      }
    }

    stage('Frontend Lint') {
      when {
        expression { return params.RUN_FRONTEND_LINT }
      }
      steps {
        sh '''
          set -euo pipefail
          docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" exec -T frontend pnpm lint
        '''
      }
    }
  }

  post {
    always {
      sh '''
        set +e
        docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" logs --no-color > compose.log
        docker compose ${COMPOSE_FILES} -p "${COMPOSE_PROJECT_NAME}" down -v --remove-orphans
      '''
      archiveArtifacts artifacts: 'compose.log', allowEmptyArchive: true
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
    }
  }
}
