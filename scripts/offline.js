(function() {
  var db;

  databaseOpen()
    .then(refreshView);

  function databaseOpen() {
    return new Promise(function(resolve, reject) {
      var version = 1;
      var request = indexedDB.open('bookmarks', version);

      // Run migrations if necessary
      request.onupgradeneeded = function(e) {
        db = e.target.result;
        e.target.transaction.onerror = reject;
        db.createObjectStore('bookmark', { keyPath: '_id' });
      };

      request.onsuccess = function(e) {
        db = e.target.result;
        resolve();
      };
      request.onerror = reject;
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    var todo = { text: input.value, _id: String(Date.now()) };
    databaseTodosPut(todo)
      .then(function() {
        input.value = '';
      })
      .then(refreshView);
  }

  function onClick(e) {

    // We'll assume that any element with an ID
    // attribute is a to-do item. Don't try this at home!
    e.preventDefault();
    if (e.target.hasAttribute('id')) {
      databaseTodosGetById(e.target.getAttribute('id'))
        .then(function(bookmark) {
          return databaseTodosDelete(bookmark);
        })
        .then(refreshView);
    }
  }

  function databaseBookmarksPut(bookmark) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(['bookmark'], 'readwrite');
      var store = transaction.objectStore('bookmark');
      var request = store.put(bookmark);
      transaction.oncomplete = resolve;
      request.onerror = reject;
    });
  }

  function databaseBookmarksGet() {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(['bookmark'], 'readonly');
      var store = transaction.objectStore('bookmark');

      // Get everything in the store
      var keyRange = IDBKeyRange.lowerBound(0);
      var cursorRequest = store.openCursor(keyRange);

      // This fires once per row in the store, so for simplicity collect the data
      // in an array (data) and send it pass it in the resolve call in one go
      var data = [];
      cursorRequest.onsuccess = function(e) {
        var result = e.target.result;

        // If there's data, add it to array
        if (result) {
          data.push(result.value);
          result.continue();

        // Reach the end of the data
        } else {
          resolve(data);
        }
      };
    });
  }

  function databaseBookmarksGetById(id) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(['bookmark'], 'readwrite');
      var store = transaction.objectStore('bookmark');
      var request = store.get(id);
      request.onsuccess = function(e) {
        var result = e.target.result;
        resolve(result);
      };
      request.onerror = reject;
    });
  }

  function databaseBookmarksDelete(bookmark) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(['bookmark'], 'readwrite');
      var store = transaction.objectStore('bookmark');
      var request = store.delete(bookmark._id);
      transaction.oncomplete = resolve;
      request.onerror = reject;
    });
  }

  /* All bookmark logic below */
  $('.iswc-show-favorites').on('click', function () {
    if ($(this).hasClass('active')) {
      showAll();
    } else {
      databaseBookmarksGet().then(filterAllBookmarks);
    }
  });


  $('.iswc-bookmark').on('click', function (e) {
    e.preventDefault();

    var $star = $(this).children('span'),
        $item = $(this).parents('.iswc-paper, .iswc-session'),
        id = $item.attr('id');

    if(!$star.hasClass('glyphicon-star')) {
      databaseBookmarksPut({_id:id}).then(function () {
        console.log(id, 'bookmarked');
        $star.removeClass('glyphicon-star-empty').addClass('glyphicon-star');
      });
    } else {
      databaseBookmarksDelete({_id:id}).then(function () {
        console.log(id, 'no longer bookmarked');
        $star.addClass('glyphicon-star-empty').removeClass('glyphicon-star');

        if ($('.iswc-show-favorites').hasClass('active')){
          $item.hide();
        }
      });
    }
  });

  function refreshView() {
    return databaseBookmarksGet().then(renderAllBookmarks);
  }

  function renderAllBookmarks(bookmarks) {
    bookmarks.forEach(function(bookmark) {
      $('#' + bookmark._id).find('.iswc-bookmark span').removeClass('glyphicon-star-empty').addClass('glyphicon-star');
    });
  }

  function filterAllBookmarks(bookmarks) {
    $('.iswc-papers .iswc-paper, .iswc-session').hide();

    bookmarks.forEach(function(bookmark) {
      $('#' + bookmark._id).show();
    });
  }

  function showAll() {
    $('.iswc-paper, .iswc-session').show();
  }

  /* All voting logic below */
  $('#votingModal').on('hidden.bs.modal', function (e) {
    $('.iswc-vote-progress').hide();
    $('.iswc-vote-code').show();
    $('.iswc-vote-success').hide();
    $('.iswc-vote-error').hide();
  });

  $('#votingModal').on('show.bs.modal', function (e) {
    $('.iswc-vote-submit').show();
    $('.iswc-vote-cancel').text('Cancel');
  });

  $('.iswc-vote-submit').on('click', function () {
    $('.iswc-vote-progress').show();
    $('.iswc-vote-code').hide();
    $(this).attr('disabled',"disabled");

    $.ajax({
      method: "POST",
      url: votingURL + '?' + $.param({vote: $('.iswc-vode-id').text()}),
      data: { key: $('.iswc-vote-code input').val() }
    })
    .done(function( msg ) {
      $('.iswc-vote-error').hide();
      $('.iswc-vote-success').show();
      $('.iswc-vote-progress').hide();
      $('.iswc-vote-code').hide();
      $('.iswc-vote-submit').hide();
      $('.iswc-vote-title').hide();
      $('.iswc-vote-submit').removeAttr('disabled');
      $('.iswc-vote-cancel').text('Close');
    })
    .fail(function( jqXHR, textStatus, errorThrown) {
      $('.iswc-vote-progress').hide();
      $('.iswc-vote-code').show();
      $('.iswc-vote-submit').removeAttr('disabled');

      if (jqXHR.status > 500 )
        $('.iswc-vote-error').text('Something went wrong (' + jqXHR.status + '): ' + errorThrown);

      $('.iswc-vote-error').show();
    });

  });

  $('.iswc-voting').on('click', function() {
   	var $subject =  $(this).parents('.iswc-paper'),
  			id = $subject.attr('id'),
  			title = $subject.find('.iswc-paper-title a').text(),
        PIndex = title.substring(1,4);

  	$('#votingModal .modal-title .iswc-vode-id').text(id);
  	$('#votingModal').find('.iswc-vote-title').html('You are about to vote for <i>' + title + '</i>');
    $('#votingModal').find('.iswc-vote-code input').val('');
    $('#votingModal').find('.iswc-vote-title').show();
    $('#votingModal').find('.iswc-vote-submit').removeAttr('disabled');

  	$('#votingModal').modal('show');
  })

}());
