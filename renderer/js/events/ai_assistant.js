{
  // Point at the questions and answers container
  let questionsAnswersContainer = $('div.body div.hidden-area div.content.ai-assistant div.questions-and-answers'),
    // Whether or not it's allowed to force scrolling to bottom if a question is being answerd
    allowScrollBottom = false

  /**
   * Clicks the `ask` button
   * This button will send a request to answer the given question from the user
   */
  $('button#askQuestion').click(function() {
    // Point at the button in the UI
    let button = $(this),
      // Get a random ID for the question
      questionID = getRandomID(10),
      // Point at the question's textarea element
      question = $('textarea#question'),
      // Save the original question - it'll be manipulated -
      originalQuestion = `${question.val()}`,
      // Point at the questions and answers container
      questionsAnswersContainer = $('div.body div.hidden-area div.content.ai-assistant div.questions-and-answers'),
      // Get the question's ask's timestamp
      questionDate = new Date().getTime()

    // If the given question is invalid - for example it's empty - then make the text area `invalid` and skip the upcoming code
    if (manipulateText(question.val()).length <= 0)
      return question.addClass('is-invalid')

    // Manipulate the question's value/content by stripping any HTML tag
    let questionValue = StripTags(question.val())

    // Add log for this action
    addLog(`Asking the AI Assistant a question: ${questionValue}`, 'action')

    // Manipulate it again by replacing new line symbol with break line html tag
    questionValue = questionValue.replace(/\n/gm, '<br>')

    // The question's UI element structure
    let element = `
        <div class="block _left">
          <div class="question" question-id="${questionID}" date="${formatTimestamp(new Date().getTime())}">
            <sdpan>${questionValue}</span>
            <div class="buttons">
              <button type="button" class="btn btn-tertiary copy" data-mdb-ripple-color="dark">
                <ion-icon name="copy"></ion-icon>
              </button>
              <button type="button" class="btn btn-tertiary delete" data-mdb-ripple-color="dark">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>`

    // Append the question to the container
    questionsAnswersContainer.append($(element).show(function() {
      // Point at the question's UI element
      let questionElement = $(this).children('div.question')

      // Clear the question's text area
      question.val('')

      // Show it - the question - with animation
      questionElement.addClass('show')

      // Scroll to the bottom of the container
      questionsAnswersContainer.animate({
        scrollTop: questionsAnswersContainer.get(0).scrollHeight
      }, 1)

      // After 0.5s, show the date and time of asking the question
      setTimeout(() => {
        questionElement.addClass('show-date')

        // After 0.2s, show the copy button
        setTimeout(() => questionElement.find('button').fadeIn(), 500)

        // When the copy icon is clicked
        questionElement.find('button.copy').click(function() {
          copyContent($(this), originalQuestion)
        })

        // When the delete icon is clicked
        questionElement.find('button.delete').click(() => deleteQuestion(questionElement))
      }, 500)

      // After 1.5s of asking the question
      setTimeout(() => {
        // The answer's UI element structure
        let element = `
            <div class="block _right">
              <div class="answer show" date question-id="${questionID}">
                <div class="text">
                  <span></span>
                  <button type="button" class="btn btn-tertiary copy" data-mdb-ripple-color="dark">
                    <ion-icon name="copy"></ion-icon>
                  </button>
                </div>
                <div class="answering">
                  <lottie-player src="../assets/lottie/answering.json" background="transparent" autoplay loop speed="1.75"></lottie-player>
                </div>
              </div>
            </div>`

        // Append the answer to the container
        questionsAnswersContainer.append($(element).show(function() {
          // Point at the answer's UI element
          let answerElement = $(this).children('div.answer')

          // Scroll the container to the bottom
          questionsAnswersContainer.animate({
            scrollTop: questionsAnswersContainer.get(0).scrollHeight
          }, 1)

          // Make sure the non-visible lottie element is not playing in the background
          {
            setTimeout(() => autoPlayStopLottieElement($(this).find('lottie-player')))
          }

          // Add log for this network request
          addLog(`Request the AI Assistant to answer the question.`, 'network')

          // Send a `POST` request to the AI assistant host server
          Axios.post(Modules.Consts.AIAssistantServer, {
              question: originalQuestion
            })
            // Once a response is received
            .then((response) => {
              // Get the answer
              let answer = response.data.result,
                // Get the answer's timestamp
                answerDate = new Date().getTime()

              // Set the response date and time
              answerElement.attr('date', formatTimestamp(answerDate))

              // If the answer is empty or the server is busy then skip the upcoming code
              if (answer.trim().length <= 0 || answer == 'busy')
                throw 0

              /**
               * Reaching here means a valid answer has been received
               *
               * Set the trade mark symbol `™` after Cassandra
               */
              answer = setApacheCassandraTMSymbol(answer)

              // Log the AI Assistant's answer
              addLog(`The AI Assistant has provided an answer: ${answer}`)

              // Wrap any given code with `code` tag
              answer = answer.replace(/\|\|(.+)\|\|/gm, '<code>$1</code>')
                .replace(/\[ANSWER\]\s*/gm, '')

              // Type the answer with set of properties
              new Typed(answerElement.children('div.text').children('span')[0], {
                strings: [answer],
                typeSpeed: 48,
                startDelay: 210,
                showCursor: false,
                onBegin: () => {
                  // On typing begin, hide the answering loading element
                  answerElement.children('div.answering').fadeOut('fast')

                  // Remove the answering indicator from the AI assistant icon in the left side
                  $(`div.group div.item[action="ai"] div.answering`).removeClass('show')

                  // Allow to force scolling to bottom
                  allowScrollBottom = true

                  // Scroll the container to the bottom
                  questionsAnswersContainer.animate({
                    scrollTop: questionsAnswersContainer.get(0).scrollHeight
                  }, 1)

                  // Remove any previous `mutate` event listener
                  questionsAnswersContainer.unbind('mutate')

                  // Listen to any change in the scroll height of the container
                  questionsAnswersContainer.mutate('scrollHeight', () => {
                    // If it's not allowed to scroll to the bottom then skip the upcoming code
                    if (!allowScrollBottom)
                      return

                    // Scroll to the bottom of the container
                    questionsAnswersContainer.animate({
                      scrollTop: questionsAnswersContainer.get(0).scrollHeight
                    }, 1)
                  })
                },
                onComplete: () => {
                  /**
                   * Once the typing process is complete
                   *
                   * Show date and time
                   */
                  answerElement.addClass('show-date')

                  // After 0.1s, show the copy button
                  setTimeout(() => answerElement.find('button').fadeIn(), 500)

                  // When the copy icon is clicked
                  answerElement.find('button').click(function() {
                    copyContent($(this), answer)
                  })

                  // Save the question and its answer
                  Modules.Aiassistant.saveQuestion(originalQuestion, questionID, questionDate, answer, answerDate, (saved) => {
                    // If something went wrong skip the upcoming code
                    if (!saved)
                      return

                    // Show the deletion button
                    setTimeout(() => questionElement.addClass('show-delete-btn'), 250)
                  })

                  // Enable the asking button and the question's textarea
                  button.add(question).removeAttr('disabled')

                  // Remove the `answering` status
                  $('div.body.show-hidden div.hidden-area div.content.ai-assistant').removeClass('answering')

                  // Disallow to force scolling to bottom
                  allowScrollBottom = false
                }
              })
            })
            // If error has been occurred
            .catch((error) => {
              setTimeout(() => {
                // Set a default answer
                let answer = I18next.capitalizeFirstLetter(I18next.t('right now there are many questions to answer, give it another try after a while')) + '.'

                // Log the failure of the process
                addLog(`The AI Assistant failed to answer the question. Error details: ${error}.`, 'error')

                // Set back the asked quesiton
                question.val(originalQuestion)

                // Set the response date and time
                answerElement.attr('date', formatTimestamp(new Date().getTime()))

                // Add `busy` class to the answer's UI element
                answerElement.addClass('busy')

                // Type the answer with set of properties
                new Typed(answerElement.children('div.text').children('span')[0], {
                  strings: [answer],
                  typeSpeed: 48,
                  startDelay: 210,
                  showCursor: false,
                  onBegin: () => {
                    // On typing begin, hide the answering loading element
                    answerElement.children('div.answering').fadeOut('fast')

                    // Remove the answering indicator from the AI assistant icon in the left side
                    $(`div.group div.item[action="ai"] div.answering`).removeClass('show')

                    // Allow to force scolling to bottom
                    allowScrollBottom = true

                    // Scroll the container to the bottom
                    questionsAnswersContainer.animate({
                      scrollTop: questionsAnswersContainer.get(0).scrollHeight
                    }, 1)

                    // Remove any previous `mutate` event listener
                    questionsAnswersContainer.unbind('mutate')

                    // Listen to any change in the scroll height of the container
                    questionsAnswersContainer.mutate('scrollHeight', () => {
                      // If it's not allowed to scroll to the bottom then skip the upcoming code
                      if (!allowScrollBottom)
                        return

                      // Scroll to the bottom of the container
                      questionsAnswersContainer.animate({
                        scrollTop: questionsAnswersContainer.get(0).scrollHeight
                      }, 1)
                    })
                  },
                  onComplete: () => {
                    /**
                     * Once the typing process is complete
                     *
                     * Show date and time
                     */
                    answerElement.addClass('show-date')

                    // After 0.1s, show the copy button
                    setTimeout(() => answerElement.find('button').fadeIn(), 500)

                    // Enable the asking button and the question's textarea
                    button.add(question).removeAttr('disabled')

                    // Remove the `answering` status
                    $('div.body.show-hidden div.hidden-area div.content.ai-assistant').removeClass('answering')

                    // Disallow to force scolling to bottom
                    allowScrollBottom = false
                  }
                })
              }, 500)
            })
        }))
      }, 1500)
    }))

    // Disable the asking button and the question's textarea
    button.add(question).attr('disabled', '')

    // Blur/focus out them as well
    setTimeout(() => button.add(question).blur())

    // The AI assistant is `answering`
    $('div.body.show-hidden div.hidden-area div.content.ai-assistant').addClass('answering')
  })

  // Once the textarea is being focused or has got new input
  $('textarea#question').on('input focus', function() {
    // Remove its `invalid` class
    $(this).removeClass('is-invalid')

    // Listen to the keypress event of the textarea
  }).on('keypress', function(e) {
    /**
     * Determine if the `ENTER` key is the one which has been pressed
     * If not then skip the upcoming code
     */
    if (e.keyCode != 13)
      return

    // If the pressed key is `ENTER` alongside holding the `SHIFT` key
    if (e.shiftKey) {
      // Prevent the default behaviour
      e.preventDefault()

      // Click the `ASK` button
      $('button#askQuestion').click()

      // Skip the upcoming code
      return
    }

    // Always scroll down at the very bottom of the text area when pressing `ENTER` without `SHIFT`
    $(this).animate({
      scrollTop: $(this).get(0).scrollHeight
    }, 1)
  })

  /**
   * This custom event for loading questions `smartly`...
   * On the first loading process it keeps loading questions till an overflow is occurred
   * After that it loads question based on a defined limitation value
   */
  $(document).on('loadQuestions', () => {
    // Get the app's config
    Modules.Config.getConfig((config) => {
      // Define the question and answer UI structure
      let blocks = {
          question: `
          <div class="block _left">
            <div class="question" question-id date>
              <span></span>
              <div class="buttons">
                <button type="button" class="btn btn-tertiary copy" data-mdb-ripple-color="dark">
                  <ion-icon name="copy"></ion-icon>
                </button>
                <button type="button" class="btn btn-tertiary delete" data-mdb-ripple-color="dark">
                  <ion-icon name="trash-outline"></ion-icon>
                </button>
              </div>
            </div>
          </div>`,
          answer: `
          <div class="block _right">
            <div class="answer" question-id date>
              <div class="text">
                <span></span>
                <button type="button" class="btn btn-tertiary copy" data-mdb-ripple-color="dark">
                  <ion-icon name="copy"></ion-icon>
                </button>
              </div>
              <div class="answering">
                <lottie-player src="../assets/lottie/answering.json" background="transparent" autoplay loop speed="1.75"></lottie-player>
              </div>
            </div>
          </div>`
        },
        // Get all added questions and their answers
        questionsAnswersElements = questionsAnswersContainer.children('div.block'),
        /**
         * Filter the added questions and their answers
         * Get the questions
         */
        questionsElements = questionsAnswersElements.filter('._left'),
        // Get the answers
        answersElements = questionsAnswersElements.filter('._right'),
        // Counter for how many questions have been loaded so far
        counter = 0,
        // Maximum number of questions to be loaded
        limit = parseInt(config.get('limit', 'assistantQuestions')),
        // Whether or not the container is over flowed
        overflowTriggered = questionsAnswersContainer[0].offsetHeight < questionsAnswersContainer[0].scrollHeight

      // Add log for this process
      addLog(`Loading previous answerd questions from the AI Assistant.`, 'process')

      /**
       * Inner function to create an element - question and its answer -
       * It takes the questions array and the index of the last added question
       */
      let createElement = (questions, index) => {
        // Get the question which will be loaded
        let question = questions[index]

        try {
          // If the question is defined - didn't reach the end of the array - then skip this try-catch block
          if (question != undefined)
            throw 0

          // The process of loading questions has been finished
          questionsAnswersContainer.parent().removeClass('loading-old-questions')

          // Skip the upcoming code
          return
        } catch (e) {}

        // If the current question has already been loaded/added then move to the next question and skip the upcoming code
        if (questionsElements.children(`div[question-id="${question.id}"]`).length > 0)
          return createElement(questions, index + 1)

        try {
          // If the container has an over flow then skip this try-catch block
          if (overflowTriggered)
            throw 0

          // Update the related flag's state
          overflowTriggered = questionsAnswersContainer[0].offsetHeight < questionsAnswersContainer[0].scrollHeight

          // After the update, if there's an over flow
          if (overflowTriggered) {
            // Reset the loading counter
            counter = 0

            // Skip the upcoming code
            return
          }
        } catch (e) {}

        // If the number of loaded questions has exceeded the limitation and there's an overflow
        if (counter >= limit && overflowTriggered) {
          // Reset the counter
          counter = 0

          // Remove the loading state
          questionsAnswersContainer.parent().removeClass('loading-old-questions')

          // Skip the upcoming code
          return
        }

        /**
         * Reaching here means a question will be loaded
         *
         * Increment the counter
         */
        ++counter

        // If there's an overflow then add a loading state
        if (overflowTriggered)
          questionsAnswersContainer.parent().addClass('loading-old-questions')

        // Prepend a question block to the container
        questionsAnswersContainer.prepend($(blocks.question).show(function() {
          // Point at the question's UI element
          let questionElement = $(this).children('div.question')

          // Manipulate the question's value/content by stripping any HTML tag
          let questionValue = StripTags(question.question)

          // Manipulate it again by replacing new line symbol with break line html tag
          questionValue = questionValue.replace(/\n/gm, '<br>')

          // Add the question's value/content
          questionElement.children('span').html(questionValue)

          // Update the question's attributes
          questionElement.attr({
            'question-id': question.id,
            'date': formatTimestamp(new Date(question.questionDate).getTime())
          })

          setTimeout(() => {
            // When the copy icon is clicked
            questionElement.find('button.copy').click(function() {
              copyContent($(this), question.question)
            })

            // When the delete icon is clicked
            questionElement.find('button.delete').click(() => deleteQuestion(questionElement))
          }, 50)

          // Slide down the question - to make the adding process smooth -
          questionElement.hide().delay(50).slideDown(() => {
            // After 0.2s add the `show` class
            setTimeout(() => {
              questionElement.addClass('show')
              // After 0.2s + 0.2s show the question's ask date
              setTimeout(() => {
                questionElement.addClass('show-date')
                // After 0.2s + 0.2s + 0.05s show the copy button
                setTimeout(() => {
                  questionElement.find('button').fadeIn()
                  // After 0.2s + 0.2s + 0.05s + 0.2s show the deletion button
                  setTimeout(() => {
                    questionElement.addClass('show-delete-btn')

                    // After 0.2s + 0.2s + 0.05s + 0.2s + 0.05s append the question's answer to the container
                    setTimeout(() => {
                      questionElement.parent().after($(blocks.answer).show(function() {
                        // Point at the answer's UI element
                        let answerElement = $(this).children('div.answer'),
                          // Manipulate the question's answer by stripping any HTML tag
                          answer = StripTags(question.answer)

                        // Put any code - CQL queries mainly - between `code` tags
                        answer = question.answer.replace(/\|\|(.+)\|\|/gm, '<code>$1</code>')
                        answer = answer.replace(/`{1,}(.+)`{1,}/gm, '<code>$1</code>')

                        // Perform other necessary changes to the answer
                        answer = answer.replace(/(\<br\>){2,}/gm, '<br>')
                          .replace(/``/gm, '')
                          .replace(/\[ANSWER\]\s*/gm, '')
                          .replace(/^<br>/gm, '')

                        // Add the answer's value/content
                        answerElement.children('div.text').children('span').html(answer)

                        // Hide the answering element inside the answer element
                        answerElement.children('div.answering').hide()

                        // Update the answer's attributes
                        answerElement.attr({
                          'question-id': question.id,
                          'date': formatTimestamp(new Date(question.answerDate).getTime())
                        })

                        // When the copy icon is clicked
                        setTimeout(() => answerElement.find('button').click(function() {
                          copyContent($(this), question.answer)
                        }), 50)

                        // Slide down the answer - to make the adding process smooth -
                        answerElement.hide().delay(50).slideDown(() => {
                          // After 0.2s add the `show` class
                          setTimeout(() => {
                            answerElement.addClass('show')
                            // After 0.2s + 0.2s show the answer's date
                            setTimeout(() => {
                              answerElement.addClass('show-date')
                              // After 0.2s + 0.2s + 0.05s show the copy button
                              setTimeout(() => {
                                answerElement.find('button').fadeIn()
                                // After 0.2s + 0.2s + 0.05s + 0.3s attempt to load the next question
                                setTimeout(() => createElement(questions, index + 1), 300)
                              }, 50)
                            }, 200)
                          }, 200)
                        })
                      }))
                    }, 50)
                  }, 200)
                }, 50)
              }, 200)
            }, 200)
          })
        }))
      }
      // End of the inner function `createElement`

      // Get all saved questions
      Modules.Aiassistant.getQuestions((questions) => {
        // Reverse them - to start from the last saved one -
        questions = questions.reverse()

        // Attempt to create/add the first question
        createElement(questions, 0)
      })
    })
  })

  // Handle the scrolling event of the questions and answers container
  {
    // Calculate the time between the last two scrolls by saving the last scroll's time
    let scrollTime = 0

    // When there's a scroll
    questionsAnswersContainer.scroll(function() {
      // Whether or not the top of the container has been reached
      let reachedTop = $(this).scrollTop() <= 10

      // Whether or not the bottom has been reached
      allowScrollBottom = ($(this).scrollTop() + $(this).innerHeight()) - $(this)[0].scrollHeight >= -20

      /**
       * If one of the following conditions is true then skip the upcoming code:
       * The top hasn't been reached
       * The time between the last two scrolls is less than 1 second
       * Questions are already being loaded
       */
      if (!reachedTop || (new Date().getTime()) - scrollTime <= 1000 || $(this).parent().hasClass('loading-old-questions'))
        return

      // Update the last scroll time
      scrollTime = new Date().getTime()

      // Trigger the loading event
      $(document).trigger('loadQuestions')
    })
  }

  /**
   * Inner functions used with `click` events of different buttons
   * Copy the content of question/answer
   */
  copyContent = (element, content) => {
    // Copy metadata to the clipboard
    try {
      Clipboard.writeText(content)
    } catch (e) {}

    // Add the `active` class
    element.addClass('active')

    // Remove it after 2.5s
    setTimeout(() => element.removeClass('active'), 250)
  }

  // Delete a question
  deleteQuestion = (questionElement) => {
    // Get the ID of the target question
    let questionID = getAttributes(questionElement, 'question-id')

    // Add log about this deletion process
    addLog(`Request to delete the AI Assistant question #${questionID}.`, 'action')

    // Confirm the deletion process
    openDialog(I18next.capitalizeFirstLetter(I18next.t('deleting a question will also delete its answer, are you sure?')), (confirmed) => {
      // If not confirmed then skip the upcoming code
      if (!confirmed)
        return

      // Delete the question
      Modules.Aiassistant.deleteQuestion(questionID, (deleted) => {
        // Add log about the process' status
        addLog(`The deletion process of the AI Assistant question #${questionID} has completed with ${deleted ? 'success' : 'failure'}.`, deleted ? 'info' : 'error')

        // If something went wrong then show feedback to the user and skip the upcoming code
        if (!deleted)
          return showToast(I18next.capitalize(I18next.t('delete question')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to delete the question') + '.'), 'failure')

        // Show success feedback
        showToast(I18next.capitalize(I18next.t('delete question')), I18next.capitalizeFirstLetter(I18next.t('the question has been successfully deleted')) + '.', 'success')

        // Remove the question UI element and its related answer
        $('div.questions-and-answers').find(`div[question-id="${questionID}"]`).remove()

        // If the overflow is now not triggered then trigger the loading questions process
        if (questionsAnswersContainer[0].offsetHeight >= questionsAnswersContainer[0].scrollHeight)
          $(document).trigger('loadQuestions')
      })
    })
  }
}
