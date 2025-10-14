// ==UserScript==
// @name         USST CAS Auto Login
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automates login to the USST CAS authentication page by filling credentials and submitting the form.
// @author       Zhuocheng Lang
// @license      MIT
// @icon         https://www.usst.edu.cn/_upload/tpl/00/40/64/template64/favicon.ico
// @match        *://ids6.usst.edu.cn/*
// @noframes
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration Storage Keys ---
    const CONFIG_KEY = 'usst_cas_config';
    const CONFIG_VERSION_KEY = 'usst_cas_config_version';
    const CURRENT_CONFIG_VERSION = 1;

    /**
     * Log a message with the script prefix
     * @param {string} message - The message to log
     */
    function log(message) {
        GM_log(`[USST Auto Login] ${message}`);
        console.log(`[USST Auto Login] ${message}`);
    }

    /**
     * Show configuration dialog
     * @param {boolean} isFirstTime - Whether this is the first time configuration
     * @returns {Promise<Object|null>} The configuration object or null if cancelled
     */
    function showConfigDialog(isFirstTime = false) {
        return new Promise((resolve) => {
            // Get existing configuration
            const existingConfig = GM_getValue(CONFIG_KEY, {});

            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999999;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            dialog.innerHTML = `
                <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">
                    ${isFirstTime ? '🔐 首次配置 USST 自动登录' : '⚙️ 修改登录配置'}
                </h2>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">
                        学号 <span style="color: red;">*</span>
                    </label>
                    <input type="text" id="usst-username" value="${existingConfig.username || ''}"
                           placeholder="请输入学号"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;" />
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">
                        密码 <span style="color: red;">*</span>
                    </label>
                    <input type="password" id="usst-password" value="${existingConfig.password || ''}"
                           placeholder="请输入密码"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;" />
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">
                        启动延迟(毫秒) <span style="color: #999; font-weight: normal;">(可选,默认10ms)</span>
                    </label>
                    <input type="number" id="usst-startup-delay" value="${existingConfig.startupDelay || 10}"
                           placeholder="10" min="0" max="5000"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;" />
                    <small style="color: #666; font-size: 12px;">脚本启动后等待多久开始自动登录</small>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">
                        操作间隔(毫秒) <span style="color: #999; font-weight: normal;">(可选,默认100ms)</span>
                    </label>
                    <input type="number" id="usst-action-delay" value="${existingConfig.actionDelay || 100}"
                           placeholder="100" min="50" max="2000"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;" />
                    <small style="color: #666; font-size: 12px;">填充表单各步骤之间的等待时间</small>
                </div>
                <div style="margin-bottom: 15px;">
                    <div id="usst-error-msg" style="color: #d32f2f; font-size: 14px; display: none; margin-bottom: 10px;"></div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    ${!isFirstTime ? '<button id="usst-cancel-btn" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer; font-size: 14px;">取消</button>' : ''}
                    <button id="usst-save-btn" style="padding: 10px 20px; border: none; background: #1976d2; color: white; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 500;">保存</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const usernameInput = dialog.querySelector('#usst-username');
            const passwordInput = dialog.querySelector('#usst-password');
            const startupDelayInput = dialog.querySelector('#usst-startup-delay');
            const actionDelayInput = dialog.querySelector('#usst-action-delay');
            const saveBtn = dialog.querySelector('#usst-save-btn');
            const cancelBtn = dialog.querySelector('#usst-cancel-btn');
            const errorMsg = dialog.querySelector('#usst-error-msg');

            /**
             * Show error message in the dialog
             * @param {string} message - The error message to display
             */
            function showError(message) {
                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
            }

            /**
             * Save configuration to GM storage
             */
            function saveConfig() {
                const username = usernameInput.value.trim();
                const password = passwordInput.value.trim();
                const startupDelay = parseInt(startupDelayInput.value) || 10;
                const actionDelay = parseInt(actionDelayInput.value) || 100;

                // Validate required fields
                if (!username) {
                    showError('请输入学号');
                    usernameInput.focus();
                    return;
                }

                if (!password) {
                    showError('请输入密码');
                    passwordInput.focus();
                    return;
                }

                // Save configuration
                const config = {
                    username,
                    password,
                    startupDelay,
                    actionDelay,
                    // Keep backward compatibility
                    timeout: startupDelay
                };

                GM_setValue(CONFIG_KEY, config);
                GM_setValue(CONFIG_VERSION_KEY, CURRENT_CONFIG_VERSION);

                log('配置已保存');
                document.body.removeChild(overlay);
                resolve(config);
            }

            /**
             * Cancel configuration
             */
            function cancelConfig() {
                document.body.removeChild(overlay);
                resolve(null);
            }

            saveBtn.addEventListener('click', saveConfig);
            if (cancelBtn) {
                cancelBtn.addEventListener('click', cancelConfig);
            }

            // Press Enter to save
            [usernameInput, passwordInput, startupDelayInput, actionDelayInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveConfig();
                    }
                });
            });

            // Focus on the first empty input field
            if (!usernameInput.value) {
                usernameInput.focus();
            } else if (!passwordInput.value) {
                passwordInput.focus();
            }
        });
    }

    /**
     * Get configuration from GM storage
     * @returns {Promise<Object|null>} The configuration object or null if cancelled
     */
    async function getConfig() {
        const configVersion = GM_getValue(CONFIG_VERSION_KEY, 0);
        let config = GM_getValue(CONFIG_KEY, null);

        // First run or incomplete configuration
        if (!config || !config.username || !config.password || configVersion < CURRENT_CONFIG_VERSION) {
            log('首次运行或配置不完整,显示配置弹窗...');
            config = await showConfigDialog(true);

            if (!config) {
                log('用户取消了配置,脚本将不会运行');
                return null;
            }
        }

        return config;
    }

    /**
     * Auto login function
     */
    async function autoLogin() {
        log('autoLogin function called.');

        // Get configuration
        const config = await getConfig();
        if (!config) {
            log('无配置信息,退出自动登录');
            return;
        }

        const {
            username: username_value,
            password: password_value,
            actionDelay = 100
        } = config;

        const loginForm = await waitForElement('#casLoginForm', 5000);
        if (!loginForm) {
            log('Login form not found after waiting. Exiting.');
            return;
        }
        log('Recognized as CAS login page.');
        log(`Login form found. Action: ${loginForm.action}`);

        // 等待用户名和密码字段加载
        const usernameField = await waitForElement('#username', 3000);
        const passwordField = await waitForElement('#password', 3000);

        if (!usernameField || !passwordField) {
            log('Username or password field not found after waiting.');
            return;
        }

        // Check if fields are available
        if (usernameField.disabled || passwordField.disabled) {
            log('Username or password field is disabled.');
            return;
        }

        // Fill form and trigger events (simulate user input)
        fillFieldWithEvents(usernameField, username_value);
        log('Username field populated with events.');

        await sleep(actionDelay / 2); // Short delay between username and password

        fillFieldWithEvents(passwordField, password_value);
        log('Password field populated with events.');

        // Use configured actionDelay
        await sleep(actionDelay);
        log(`Waited ${actionDelay}ms for event processing.`);

        // Trigger blur events (may trigger captcha check)
        usernameField.dispatchEvent(new Event('blur', { bubbles: true }));
        passwordField.dispatchEvent(new Event('blur', { bubbles: true }));

        // Check if captcha is required
        const captchaImg = document.getElementById('captchaImg');
        const needsCaptcha = captchaImg && captchaImg.querySelector('img');

        if (needsCaptcha) {
            log('Captcha detected. Waiting for user input...');
            // If captcha is required, wait longer or return directly
            await sleep(actionDelay * 10);
        } else {
            log('No captcha detected. Proceeding with auto-submit.');
            await sleep(actionDelay * 2);
        }

        // Submit form
        await submitForm(loginForm);
    }

    /**
     * Wait for element to appear in DOM
     * @param {string} selector - CSS selector
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<Element|null>} The element or null if timeout
     */
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    /**
     * Fill field and trigger all related events
     * @param {HTMLInputElement} field - The input field to fill
     * @param {string} value - The value to set
     */
    function fillFieldWithEvents(field, value) {
        // Focus field
        field.focus();

        // Set value using native setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;
        nativeInputValueSetter.call(field, value);

        // Trigger all related events
        const events = ['input', 'change', 'keydown', 'keyup'];
        events.forEach(eventType => {
            field.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Submit the login form
     * @param {HTMLFormElement} loginForm - The login form element
     */
    async function submitForm(loginForm) {
        log('Attempting to submit form...');

        // Use ID selector to locate login button
        const submitButton = document.getElementById('login_submit')
            || loginForm.querySelector('button[type="submit"].auth_login_btn')
            || loginForm.querySelector('button[type="submit"]')
            || loginForm.querySelector('input[type="submit"]');

        if (submitButton) {
            log(`Found submit button: ${submitButton.tagName}#${submitButton.id || '(no id)'}.${submitButton.className || '(no class)'}`);

            // Check if button is available
            if (submitButton.disabled) {
                log('Submit button is disabled. Cannot submit.');
                return;
            }

            log('Clicking submit button...');
            submitButton.click();
        } else {
            log('Submit button not found. Attempting direct form submission...');
            // Fallback: trigger form submit event
            const submitEvent = new Event('submit', {
                bubbles: true,
                cancelable: true
            });

            if (loginForm.dispatchEvent(submitEvent)) {
                // If event is not prevented, submit directly
                log('Submit event not prevented, calling form.submit()');
                loginForm.submit();
            } else {
                log('Submit event was prevented (validation may have failed)');
            }
        }
    }

    // Register menu command to allow users to modify configuration anytime
    GM_registerMenuCommand('⚙️ 修改登录配置', async () => {
        await showConfigDialog(false);
        log('配置已更新,请刷新页面使新配置生效');
        alert('配置已更新!请刷新页面使新配置生效。');
    });

    // Main logic
    const specificCasLoginUrlPattern = 'https://ids6.usst.edu.cn/authserver/login';
    log(`Current page URL: ${window.location.href}`);

    if (window.location.href.startsWith(specificCasLoginUrlPattern)) {
        log(`Matched specific CAS login URL pattern: "${specificCasLoginUrlPattern}". Proceeding with autoLogin.`);

        // Ensure DOM is fully loaded before execution
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                getConfig().then(config => {
                    if (config) {
                        const startupDelay = config.startupDelay || 10;
                        log(`Starting auto-login after ${startupDelay}ms delay...`);
                        setTimeout(autoLogin, startupDelay);
                    }
                });
            });
        } else {
            // Get configuration and execute auto-login
            getConfig().then(config => {
                if (config) {
                    const startupDelay = config.startupDelay || 10;
                    log(`Starting auto-login after ${startupDelay}ms delay...`);
                    setTimeout(autoLogin, startupDelay);
                }
            });
        }
    } else {
        log(`URL does not match specific CAS login pattern "${specificCasLoginUrlPattern}". Auto-login will not run on this page.`);
    }

})();
