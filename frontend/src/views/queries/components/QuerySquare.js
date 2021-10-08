import React, {useEffect, useState} from 'react'
import {Button, Col, Divider, Input } from 'antd'
import CustomVerticalDivider from "./CustomVerticalDivider";


const QuerySquare = props => {
  const { TextArea } = Input
  const [query, setQuery] = useState('')

  useEffect(() => {
    setQuery(props.querySaved)
    // eslint-disable-next-line
  }, [props.querySaved])

  return (
    <>
    <TextArea
      disabled={props.loading}
      className={'query-square ' + props.className}
      value={query}
      name={'query'}
      onChange={event => setQuery(event.target.value) }
    />
      <Divider style={{ backgroundColor: 'lightgray' }} />
      <Col sm={24} style={{ display: 'flex', justifyContent: 'center' }}>
        <Button disabled={props.loading} onClick={_=>props.handleQuery(query,1)}  type={'primary'}>
           Execute
        </Button>
        <CustomVerticalDivider />
        <Button disabled={props.loading} onClick={_=>props.handleSocketQuery(query,1)}  type={'primary'}>
           Execute Long Query
        </Button>
        <Button
          className={'hidden-element'}
          disabled={props.loading}
          //onClick={() => setIsOpenSaveQueryModal(true)}
        >
          Save Query
        </Button>
        <CustomVerticalDivider />

        <Button
          disabled={props.loading}
          onClick={_=>props.handlerExcel(query)}  >
          Execute to Excel
        </Button>

        <CustomVerticalDivider />
        <Button
          disabled={props.loading} onClick={props.handleToCopy} >
          Copy to Clipboard
        </Button>

      </Col>
    </>
  )
}

QuerySquare.defaultProps = {
  className: '',
  loading: false,
  style: {},
}
export default QuerySquare
