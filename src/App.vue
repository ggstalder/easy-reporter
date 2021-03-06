<template>
  <div id="app">
    <template v-if="token">
      <div class="page-container md-layout-row">
        <md-app>
          <md-app-toolbar class="md-primary">
            <span class="md-title">Informations</span>
          </md-app-toolbar>
          <md-app-drawer md-permanent="full">
            <md-toolbar class="md-transparent" md-elevation="0">Reports
              <div class="md-toolbar-section-end">
                <md-checkbox v-model="debug">Debug</md-checkbox>
                <md-checkbox v-model="deleted">Deleted</md-checkbox>
                <md-checkbox v-model="uploaded">Uploaded</md-checkbox>
                <md-button class="md-raised md-accent" v-on:click="list">Refresh</md-button>
              </div>
            </md-toolbar>
            <md-list class="md-triple-line">
              <md-list-item
                v-for="report in filteredReports"
                :key="report.filename"
                @click="info(report)"
              >
                <md-icon
                  v-bind:class="{ 'success': report.uploaded, 'failure': !report.uploaded }"
                >cloud_upload</md-icon>
                <div class="md-list-item-text">
                  <span>{{ report.filename }}</span>
                  <span>Version: {{ report.version }}</span>
                  <p>Created: {{ report.created_at }}</p>
                </div>
                <md-icon class="failure" v-if="report.deleted_at">deleted_at</md-icon>
                <md-icon class="failure" v-if="report.debug">bug_report</md-icon>
              </md-list-item>
            </md-list>
          </md-app-drawer>
          <md-app-content>
            <template>
              <div v-if="sending">
                <md-progress-bar md-mode="indeterminate"></md-progress-bar>
              </div>
              <div class="md-layout" md-card v-if="report != null">
                <md-button
                  class="md-raised md-primary"
                  :disabled="sending"
                  @click="downloadReport()"
                >Download</md-button>
                <md-button
                  class="md-raised md-accent"
                  :disabled="sending"
                  @click="deleteReport()"
                >Delete</md-button>
              </div>
              <div class="md-layout" v-if="report != null">
                <div class="md-layout-item md-size-60">
                  <md-content>
                    <p class="md-display-1">{{ report.data.error }}</p>
                    <p class="md-body-2">{{ report.data.error_descr }}</p>
                  </md-content>
                </div>
                <div class="md-layout-item md-size-15">
                  <md-card class="system-info">
                    <md-card-header>
                      <div class="md-title">System</div>
                    </md-card-header>

                    <md-card-content>
                      <div class="md-list-item-text">
                        <span>OS: {{ report.system.name }}</span>
                        <span>Can thread: {{ report.system.cpu.thread }}</span>
                        <span>CPU count: {{ report.system.cpu.count }}</span>
                        <span>Model: {{ report.system.cpu.model }}</span>
                        <span>Locale: {{ report.system.locale }}</span>
                        <span>VSync: {{ report.system.screen.vsync }}</span>
                        <span>Resolution: {{ report.system.screen.resolution }}</span>
                        <span>Fullscreen: {{ report.system.screen.fullscreen }}</span>
                        <span>Window size: {{ report.system.screen.size }}</span>
                      </div>
                    </md-card-content>
                  </md-card>
                </div>
              </div>
              <div class="md-layout" v-if="report != null">
                <div class="md-layout-item md-size-33">
                  <md-card class="system-info">
                    <md-card-header>
                      <div class="md-title">Callstack</div>
                    </md-card-header>

                    <md-card-content>
                      <div class="md-list-item-text">
                        <span>{{ report.data.source_file }}: {{ report.data.source_line }} ({{ report.data.source_func }})</span>
                      </div>
                      <div
                        class="md-list-item-text"
                        v-for="item in formatCallstack(report.data.callstack)"
                        :key="item.name"
                      >
                        <span>{{ item.name }}: {{ item.line }}</span>
                      </div>
                    </md-card-content>
                  </md-card>
                </div>
                <div class="md-layout-item md-size-60">
                  <pre>
                    {{ report.logdump }}
                  </pre>
                </div>
              </div>
            </template>
          </md-app-content>
        </md-app>
      </div>
    </template>
    <template v-if="!token">
      <div class="md-layout">
        <md-card class="md-layout-item md-size-50 md-small-size-100">
          <md-card-header>
            <div class="md-title">Login</div>
          </md-card-header>
          <md-card-content>
            <md-field md-clearable>
              <label>Username</label>
              <md-input v-model="username"></md-input>
            </md-field>

            <md-field>
              <label>Password</label>
              <md-input v-model="password" type="password"></md-input>
            </md-field>
          </md-card-content>

          <md-card-actions>
            <md-button type="submit" class="md-primary" :disabled="sending" @click="login">Login</md-button>
          </md-card-actions>
        </md-card>
      </div>
    </template>
    <ErrorSnackbar ref="errorSnackbar"></ErrorSnackbar>
  </div>
</template>

<script>
import ErrorSnackbar from "./components/ErrorSnackbar.vue";
import VueApexCharts from "vue-apexcharts";

export default {
  name: "Reports",
  components: {
    ErrorSnackbar,
    VueApexCharts
  },
  data() {
    return {
      reports: [],
      cache: {},
      report: null,
      username: "",
      password: "",
      filename: null,
      sending: false,
      token: null,
      debug: false,
      deleted: false,
      uploaded: true,
      chartOptions: {
        chart: {
          height: 380,
          type: "line",
          shadow: {
            enabled: true,
            color: "#000",
            top: 18,
            left: 7,
            blur: 10,
            opacity: 1
          },
          animations: {
            enabled: true,
            easing: "easeinout",
            speed: 800,
            animateGradually: {
              enabled: true,
              delay: 150
            },
            dynamicAnimation: {
              enabled: true,
              speed: 350
            }
          }
        },
        markers: {
          size: 0
        },
        stroke: {
          curve: "straight",
          lineCap: "round",
          width: 1
        },
        yaxis: {
          min: 0,
          max: 120000,
          labels: {
            formatter: function(val) {
              return `${val} ms`;
            }
          }
        }
      }
    };
  },
  computed: {
    filteredReports: function() {
      let self = this;

      return this.reports.filter(report => {
        return (
          report.uploaded == self.uploaded &&
          (report.deleted_at != null) == self.deleted &&
          report.debug == self.debug
        );
      });
    }
  },
  methods: {
    formatCallstack: function(callstack) {
      return callstack.reduce((acc, item, index) => {
        let computed_index = parseInt(Math.floor(index / 2), 10);

        if (index % 2 == 0) {
          acc[computed_index] = {
            name: item
          };
        } else {
          acc[computed_index].line = item;
        }

        return acc;
      }, []);
    },
    downloadReport: function() {
      var dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(this.report, null, 2));
      var downloadAnchorNode = document.createElement("a");

      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", this.filename + ".json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    },
    deleteReport: function() {
      this.sending = true;

      this.$http({
        method: "DELETE",
        url: `/report/${encodeURIComponent(this.filename)}`,
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      }).then(() => {
        this.report = null;
        this.filename = null;

        this.sending = false;

        return this.list();
      });
    },
    info: function(report) {
      this.report = null;
      this.filename = null;

      if (report.deleted_at != null || !report.uploaded) {
        return;
      }

      this.sending = true;

      this.$http({
        method: "get",
        url: `/report/${encodeURIComponent(report.filename)}`,
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      }).then(response => {
        this.filename = report.filename;
        this.report = response.data;

        this.sending = false;
      });
    },
    login: function() {
      this.sending = true;

      this.$http
        .post(`/user/login`, {
          username: this.username,
          password: this.password
        })
        .then(response => {
          this.token = response.data;
          this.sending = false;

          return this.list();
        })
        .catch(err => {
          this.sending = false;

          this.$refs.errorSnackbar.show(`Login failed: ${err.message}`);
        });
    },
    list: function() {
      this.sending = true;

      this.$http({
        method: "get",
        url: "/report/list",
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      }).then(response => {
        this.reports = response.data;
        this.sending = false;
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.full-control > .md-list {
  width: 100%;
  max-width: 100%;
  display: inline-block;
  border: 1px solid rgba(#000, 0.12);
  vertical-align: top;
}

.success {
  color: green !important;
}

.failure {
  color: red !important;
}

.md-drawer {
  width: 512px;
  max-width: calc(100vw - 125px);
}

.md-app {
  border: 1px solid rgba(#000, 0.12);
}

.md-progress-bar {
  margin: 24px;
}

.md-app-content {
  overflow-x: none;
}

.system-info {
  width: 320px;
  margin: 4px;
  display: inline-block;
  vertical-align: top;
}

.logdump {
  width: 100%;
  height: 100%;
}
</style>
