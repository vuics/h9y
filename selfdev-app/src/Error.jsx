import {
  Container,
  Divider,
  Message,
  Icon,
} from 'semantic-ui-react'

export default function Error () {
  console.log('window.location.href:', window.location.href);
  console.log('window.history.length:', window.history.length);
  return (
    <Container>
      <Divider hidden />

      <Message negative icon>
        <Icon name='exclamation triangle' />
        <Message.Content>
          <Message.Header>Error</Message.Header>
          No such a page.
        </Message.Content>
      </Message>
    </Container>
  )
}

